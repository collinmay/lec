Sequel.migration do
  change do
    alter_table(:countdown) do
      add_column :sync_kill, TrueClass, :null => false, :default => false
    end
  end
end
