#!/usr/bin/env python3
"""
MySQL Connection Diagnostic Script
This script tests the MySQL connection and provides detailed debugging information.
"""

import os
import sys
from dotenv import load_dotenv
import pymysql
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

# Load environment variables
load_dotenv()

def test_connection():
    # Get connection parameters
    ENV = os.getenv("ENV", "prod").lower()
    
    if ENV == "dev":
        print("ENV is set to 'dev' - SQLite will be used instead of MySQL")
        return
    
    MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER = os.getenv("MYSQL_USER", "openmemory_user")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "openmemory_pass")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "openmemory")
    
    print(f"Testing MySQL connection with:")
    print(f"  Host: {MYSQL_HOST}")
    print(f"  Port: {MYSQL_PORT}")
    print(f"  User: {MYSQL_USER}")
    print(f"  Database: {MYSQL_DATABASE}")
    print(f"  Password: {'*' * len(MYSQL_PASSWORD) if MYSQL_PASSWORD else '(empty)'}")
    print()
    
    # Test 1: Direct PyMySQL connection
    print("Test 1: Direct PyMySQL connection...")
    try:
        connection = pymysql.connect(
            host=MYSQL_HOST,
            port=MYSQL_PORT,
            user=MYSQL_USER,
            password=MYSQL_PASSWORD,
            database=MYSQL_DATABASE,
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor
        )
        print("✓ Direct PyMySQL connection successful!")
        
        # Test query
        with connection.cursor() as cursor:
            cursor.execute("SELECT VERSION()")
            result = cursor.fetchone()
            print(f"  MySQL Version: {result['VERSION()']}")
        
        connection.close()
    except Exception as e:
        print(f"✗ Direct PyMySQL connection failed: {e}")
        print(f"  Error type: {type(e).__name__}")
    
    print()
    
    # Test 2: SQLAlchemy connection
    print("Test 2: SQLAlchemy connection...")
    try:
        # Try with auth_plugin
        DATABASE_URL = f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4"
        engine = create_engine(
            DATABASE_URL,
            pool_pre_ping=True,
            connect_args={
                "connect_timeout": 10,
                "charset": "utf8mb4"
#                "charset": "utf8mb4",
#                "auth_plugin": "mysql_native_password"
            }
        )
        
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✓ SQLAlchemy connection with auth_plugin successful!")
    except Exception as e:
        print(f"✗ SQLAlchemy connection with auth_plugin failed: {e}")
        
        # Try without auth_plugin
        print("\nTrying without auth_plugin...")
        try:
            engine = create_engine(
                DATABASE_URL,
                pool_pre_ping=True,
                connect_args={
                    "connect_timeout": 10,
                    "charset": "utf8mb4"
                }
            )
            
            with engine.connect() as conn:
                result = conn.execute(text("SELECT 1"))
                print("✓ SQLAlchemy connection without auth_plugin successful!")
        except Exception as e2:
            print(f"✗ SQLAlchemy connection without auth_plugin also failed: {e2}")
    
    print()
    
    # Suggestions
    print("Troubleshooting suggestions:")
    print("1. If you see 'Access denied', check your MySQL user credentials")
    print("2. If you see 'Can't connect to MySQL server', check:")
    print("   - Is MySQL running? (sudo systemctl status mysql)")
    print("   - Is it listening on the correct port? (sudo netstat -tlnp | grep 3306)")
    print("   - Is 'localhost' resolving correctly? Try '127.0.0.1' instead")
    print("3. For MySQL 8.0 authentication issues:")
    print("   - ALTER USER 'your_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';")
    print("   - Or create user with: CREATE USER 'your_user'@'localhost' IDENTIFIED WITH mysql_native_password BY 'your_password';")
    print("4. Check if you need to specify the host as '127.0.0.1' instead of 'localhost'")


def test_connection_new():
    # Get connection parameters
    ENV = os.getenv("ENV", "prod").lower()

    if ENV == "dev":
        print("ENV is set to 'dev' - SQLite will be used instead of MySQL")
        return

    MYSQL_HOST = os.getenv("MYSQL_HOST", "127.0.0.1")
    MYSQL_PORT = int(os.getenv("MYSQL_PORT", "3306"))
    MYSQL_USER = os.getenv("MYSQL_USER", "openmemory_user")
    MYSQL_PASSWORD = os.getenv("MYSQL_PASSWORD", "openmemory_pass")
    MYSQL_DATABASE = os.getenv("MYSQL_DATABASE", "openmemory")

    print(f"Testing MySQL connection with:")
    print(f"  Host: {MYSQL_HOST}")
    print(f"  Port: {MYSQL_PORT}")
    print(f"  User: {MYSQL_USER}")
    print(f"  Database: {MYSQL_DATABASE}")
    print(f"  Password: {'*' * len(MYSQL_PASSWORD) if MYSQL_PASSWORD else '(empty)'}")
    print()

    DATABASE_URL = os.getenv(
        "DATABASE_URL", 
        f"mysql+pymysql://{MYSQL_USER}:{MYSQL_PASSWORD}@{MYSQL_HOST}:{MYSQL_PORT}/{MYSQL_DATABASE}?charset=utf8mb4"
    )
    
    # Create engine with MySQL-specific connection args
    engine = create_engine(
        DATABASE_URL,
        pool_pre_ping=True,  # Verify connections before using them
        pool_recycle=3600,   # Recycle connections after 1 hour
        connect_args={
            "connect_timeout": 10,
            "charset": "utf8mb4"
        }
    )
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    with SessionLocal.begin() as session:
        print('session created')
    


if __name__ == "__main__":
    test_connection_new() 
