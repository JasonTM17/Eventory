SELECT 'CREATE DATABASE eventory_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'eventory_test')\gexec
