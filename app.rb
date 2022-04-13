require "bundler/setup"

require "active_support" # https://github.com/rails/rails/issues/43851
require "active_support/core_ext/numeric/time.rb" # for .seconds
require "sinatra/base"
require "haml"
require "sequel"
require "rqrcode"
require "time"
require "bunny"

class LecApp < Sinatra::Application
  AMQP_SERVER = "placeholder"
  HOST = "localhost"
  BASE_URL = "http://#{HOST}:9292"
  WEBSOCKET_COUNTDOWN_URL = "ws://#{HOST}:9293"
  WEBSOCKET_LEADERBOARD_URL = "ws://#{HOST}:9294"

  MQ = Bunny.new(AMQP_SERVER)
  MQ.start
  MQ_CH = MQ.create_channel
  MQ_EX_COUNTDOWN = MQ_CH.fanout("countdown", :durable => false)
  MQ_EX_LEADERBOARD = MQ_CH.fanout("leaderboard", :durable => false)
  
  DB = Sequel.sqlite

  DB.create_table(:times) do
    primary_key :id
    String :name, :null => false
    Float :duration, :null => false
    DateTime :submission, :null => false
    TrueClass :disqualified, :null => false, :default => false
  end

  DB.create_table(:countdown) do
    DateTime :set_point, :null => false
    TrueClass :active, :null => false
  end

  DB[:countdown].insert(:set_point => DateTime.now + 30.seconds, :active => false)
  
  DB[:times].insert(:name => "Dubs",       :duration => 183.45, :submission => DateTime.parse("4:35:16 PM, April 20, 2022"))
  DB[:times].insert(:name => "Peter Fink", :duration => 104.12, :submission => DateTime.parse("4:33:42 PM, April 20, 2022"))
  DB[:times].insert(:name => "Your Mom",   :duration =>  44.03, :submission => DateTime.parse("4:32:21 PM, April 20, 2022"), :disqualified => true)
  DB[:times].insert(:name => "Your Mom",   :duration =>  52.56, :submission => DateTime.parse("4:32:28 PM, April 20, 2022"))

  JOIN_QR_PNG = RQRCode::QRCode.new(BASE_URL + "/participant").as_png(:size => 800)

  helpers do
    def update_leaderboard
      MQ_EX_LEADERBOARD.publish("update")
      puts "sent item to queue"
    end

    def set_countdown(time)
      DB[:countdown].update(:set_point => time)
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
    return JSON.generate({:endpoint => WEBSOCKET_COUNTDOWN_URL})
  end

  get "/api/ws-endpoint/leaderboard" do
    content_type "application/json"
    return JSON.generate({:endpoint => WEBSOCKET_LEADERBOARD_URL})
  end

  get "/api/countdown" do
    content_type "application/json"
    row = DB[:countdown].first
    return JSON.generate({:set_point => row[:set_point].to_time.to_i, :active => row[:active]})
  end

  get "/manager" do
    ds = DB[:times].select(:id, :name, :duration, :submission, :disqualified)
    haml :manager, :locals => {:ds => ds, :error => nil}
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

  post "/manager/countdown/set" do
    set_countdown(Time.parse(params[:set_point]).to_i)
    redirect "/manager"
  end
  
  post "/manager" do
    if(params[:id] == "create") then
      DB[:times].insert(:name => params[:name], :duration => params[:duration], :submission => DateTime.now)
      update_leaderboard
      redirect "/manager"
    else
      num = DB[:times].where(:id => params[:id]).update(
        :name => params[:name],
        :duration => params[:duration],
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
