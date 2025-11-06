const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'chatapp',
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
  // Remove the invalid options: acquireTimeout, timeout, reconnect
});

const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Database connected successfully');
    connection.release();
    
    // Initialize database
    await initializeDatabase();
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.log('💡 Please check:');
    console.log('   - Is MySQL running?');
    console.log('   - Check your username/password in .env file');
    console.log('   - Does the database exist?');
    
    // Try to create database if it doesn't exist
    await createDatabaseIfNotExists();
  }
};

const createDatabaseIfNotExists = async () => {
  try {
    // Create a connection without specifying database
    const tempPool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });
    
    const dbName = process.env.DB_NAME || 'chatapp';
    
    // Create database if it doesn't exist
    await tempPool.execute(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
    console.log(`✅ Database '${dbName}' created or already exists`);
    
    await tempPool.end();
    
    // Now try to connect again with database
    const connection = await pool.getConnection();
    console.log('✅ Now connected to database successfully');
    connection.release();
    
    await initializeTables();
  } catch (error) {
    console.error('❌ Failed to create database:', error.message);
  }
};

const initializeTables = async () => {
  try {
    // Users table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        display_name VARCHAR(100),
        profile_picture_url VARCHAR(255),
        status ENUM('online', 'offline', 'away', 'busy') DEFAULT 'offline',
        last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        is_active BOOLEAN DEFAULT TRUE
      )
    `);

    // Conversations table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(100),
        description TEXT,
        is_group BOOLEAN DEFAULT FALSE,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        avatar_url VARCHAR(255)
      )
    `);

    // Conversation participants
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS conversation_participants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        user_id INT NOT NULL,
        joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        role ENUM('admin', 'member') DEFAULT 'member',
        nickname VARCHAR(50),
        is_active BOOLEAN DEFAULT TRUE,
        last_read_message_id INT,
        UNIQUE KEY unique_participant (conversation_id, user_id)
      )
    `);

    // Messages table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        conversation_id INT NOT NULL,
        sender_id INT NOT NULL,
        message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
        content TEXT NOT NULL,
        media_url VARCHAR(255),
        file_name VARCHAR(255),
        file_size BIGINT,
        mime_type VARCHAR(100),
        reply_to_message_id INT,
        is_edited BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP NULL
      )
    `);

    // Message read receipts
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS message_read_receipts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        message_id INT NOT NULL,
        user_id INT NOT NULL,
        read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_read_receipt (message_id, user_id)
      )
    `);

    // Friendships table
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS friendships (
        id INT PRIMARY KEY AUTO_INCREMENT,
        user_id1 INT NOT NULL,
        user_id2 INT NOT NULL,
        status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
        action_user_id INT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CHECK (user_id1 < user_id2),
        UNIQUE KEY unique_friendship (user_id1, user_id2)
      )
    `);

    console.log('✅ Database tables initialized successfully');
  } catch (error) {
    console.error('❌ Error initializing tables:', error.message);
  }
};

const initializeDatabase = async () => {
  await initializeTables();
};

module.exports = { pool, testConnection };