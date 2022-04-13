Sequel.migration do
  change do
    create_table(:times) do
      primary_key :id
      String :name, :null => false
      Float :duration, :null => false
      DateTime :submission, :null => false
      TrueClass :disqualified, :null => false, :default => false
    end

    create_table(:countdown) do
      DateTime :set_point, :null => false
      TrueClass :active, :null => false
    end
  end
end
