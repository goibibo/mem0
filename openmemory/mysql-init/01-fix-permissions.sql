-- Grant permissions to trip_user from all hosts
CREATE USER IF NOT EXISTS 'openmemory_user'@'%' IDENTIFIED BY 'openmemory_pass';
GRANT ALL PRIVILEGES ON *.* TO 'openmemory_user'@'%';

-- Create specific grants for common Docker network hostnames
CREATE USER IF NOT EXISTS 'openmemory_user'@'localhost' IDENTIFIED BY 'openmemory_pass';
GRANT ALL PRIVILEGES ON *.* TO 'openmemory_user'@'localhost';

CREATE USER IF NOT EXISTS 'openmemory_user'@'host.docker.internal' IDENTIFIED BY 'openmemory_pass';
GRANT ALL PRIVILEGES ON *.* TO 'openmemory_user'@'host.docker.internal';

-- Update root permissions
CREATE USER IF NOT EXISTS 'root'@'%' IDENTIFIED BY 'openmemory_root_pass';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' WITH GRANT OPTION;

-- Flush privileges to apply changes
FLUSH PRIVILEGES; 
