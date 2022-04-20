require "bundler/setup"

require "active_support" # https://github.com/rails/rails/issues/43851
require "active_support/core_ext/numeric/time.rb" # for .seconds
require "sinatra/base"
require "sinatra/config_file"
require "haml"
require "sequel"
require "rqrcode"
require "time"
require "bunny"

class LecApp < Sinatra::Application
  set :reset_test_data, false
  config_file "./config.yml"
  
  MQ = Bunny.new(settings.aqmp_url)
  MQ.start
  MQ_CH = MQ.create_channel
  MQ_EX_COUNTDOWN = MQ_CH.fanout("countdown", :durable => false)
  MQ_EX_LEADERBOARD = MQ_CH.fanout("leaderboard", :durable => false)

  Sequel.extension :migration
  DB = Sequel.connect(settings.db_url)
  Sequel::Migrator.run(DB, './migrations')
  
  if settings.reset_test_data then
    DB[:countdown].delete
    DB[:times].delete
  
    DB[:times].insert(:name => "Dubs",       :duration => 183.45, :submission => DateTime.parse("4:35:16 PM, April 20, 2022"))
    DB[:times].insert(:name => "Peter Fink", :duration => 104.12, :submission => DateTime.parse("4:33:42 PM, April 20, 2022"))
    DB[:times].insert(:name => "Your Mom",   :duration =>  44.03, :submission => DateTime.parse("4:32:21 PM, April 20, 2022"), :disqualified => true)
    DB[:times].insert(:name => "Your Mom",   :duration =>  52.56, :submission => DateTime.parse("4:32:28 PM, April 20, 2022"))

    80.times do |i|
      DB[:times].insert(:name => "test #{i}", :duration => Random.rand(15 * 60), :submission => DateTime.parse("4:53:22 PM, April 20, 2022"))
    end
  end

  if DB[:countdown].count == 0 then
    DB[:countdown].insert(:set_point => DateTime.now + 30.seconds, :active => false, :sync_kill => false)
  end
  
  JOIN_QR_PNG = RQRCode::QRCode.new(settings.base_url + "/participant").as_png(:size => 800)

  helpers do
    def update_leaderboard
      MQ_EX_LEADERBOARD.publish("update")
      puts "sent item to queue"
    end

    def set_countdown(time)
      DB[:countdown].update(:set_point => Time.at(time).to_datetime)
      MQ_EX_COUNTDOWN.publish("set")
    end

    def get_countdown
      @countdown||= Time.at(DB[:countdown].select(:set_point).first[:set_point]).to_datetime
    end

    def countdown_active?
      DB[:countdown].select(:active).first[:active]
    end
    
    def begin_countdown
      DB[:countdown].update(:active => true)
      MQ_EX_COUNTDOWN.publish("begin")
    end

    def cancel_countdown
      DB[:countdown].update(:active => false)
      MQ_EX_COUNTDOWN.publish("cancel")
    end

    def kill_sync
      DB[:countdown].update(:sync_kill => true)
      MQ_EX_COUNTDOWN.publish("syncKill")
    end

    def unkill_sync
      DB[:countdown].update(:sync_kill => false)
      MQ_EX_COUNTDOWN.publish("syncUnkill")
    end
  end
  
  get "/" do
    haml :index
  end

  get "/presenter" do
    ds = DB[:times]
           .where(:disqualified => false)
           .select(:id, :name, :duration, Sequel.function(:max, :submission).as(:submission))
           .group_by(:name)
           .order_by(:duration)
    haml :presenter, :locals => {:ds => ds}
  end

  get "/participant" do
    haml :participant
  end

  post "/participant/submit" do
    DB[:times].insert(:name => params[:name], :duration => params[:duration].to_f.floor, :submission => DateTime.now)

    update_leaderboard
    
    redirect "/participant"
  end

  get "/api/leaderboard" do
    content_type "application/json"
    ds = DB[:times]
           .where(:disqualified => false)
           .select(:id, :name, :duration, Sequel.function(:max, :submission).as(:submission))
           .group_by(:name)
           .order_by(:duration)
    return JSON.generate(ds.to_a)
  end
  
  get "/api/ws-endpoint/participant" do
    content_type "application/json"
    return JSON.generate({:endpoint => settings.ws_countdown_url})
  end

  get "/api/ws-endpoint/leaderboard" do
    content_type "application/json"
    return JSON.generate({:endpoint => settings.ws_leaderboard_url})
  end

  get "/api/countdown" do
    content_type "application/json"
    row = DB[:countdown].first
    return JSON.generate({:set_point => row[:set_point].to_time.to_i, :active => row[:active]})
  end

  get "/api/synchronizer" do
    content_type "application/json"
    kill = DB[:countdown].first[:sync_kill]
    return JSON.generate(
             {
               :time => DateTime.now.to_time.to_f * 1000.0,
               :kill => kill
             })
  end
  
  get "/manager" do
    ds = DB[:times].select(:id, :name, :duration, :submission, :disqualified)
    sync_kill = DB[:countdown].first[:sync_kill]
    haml :manager, :locals => {:ds => ds, :error => nil, :sync_kill => sync_kill}
  end

  get "/manager/force-leaderboard-update" do
    update_leaderboard
    redirect "/manager"
  end

  get "/manager/countdown/begin" do
    begin_countdown
    redirect "/manager"
  end

  get "/manager/countdown/cancel" do
    cancel_countdown
    redirect "/manager"
  end

  get "/manager/sync/kill" do
    kill_sync
    redirect "/manager"
  end
  
  get "/manager/sync/unkill" do
    unkill_sync
    redirect "/manager"
  end
  
  post "/manager/countdown/set" do
    set_countdown(Time.parse(params[:set_point]).to_i)
    redirect "/manager"
  end
  
  post "/manager" do
    if(params[:id] == "create") then
      DB[:times].insert(:name => params[:name], :duration => ((params[:duration_m].to_f * 60) + params[:duration_s].to_f), :submission => DateTime.now)
      update_leaderboard
      redirect "/manager"
    else
      num = DB[:times].where(:id => params[:id]).update(
        :name => params[:name],
        :duration => ((params[:duration_m].to_f * 60.0) + params[:duration_s].to_f),
        :disqualified => !!params[:disqualified])
      if(num == 0) then
        return "No such record for edit operation"
      end
      update_leaderboard
      redirect "/manager"
    end
  end
  
  get "/join.png" do
    cache_control :public, :max_age => 60 * 60, :must_revalidate => true
    content_type "image/png"
    return JOIN_QR_PNG.to_s
  end
end
