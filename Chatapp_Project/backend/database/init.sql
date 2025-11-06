-- Create database
CREATE DATABASE chatapp;
USE chatapp;

-- ==========================
-- USERS TABLE
-- ==========================
CREATE TABLE users (
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
    is_active BOOLEAN DEFAULT TRUE,
    INDEX idx_username (username),
    INDEX idx_email (email)
);

-- ==========================
-- CONVERSATIONS TABLE
-- ==========================
CREATE TABLE conversations (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100),
    description TEXT,
    is_group BOOLEAN DEFAULT FALSE,
    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    avatar_url VARCHAR(255),
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_is_group (is_group),
    INDEX idx_last_message (last_message_at)
);

-- ==========================
-- PARTICIPANTS TABLE
-- ==========================
CREATE TABLE conversation_participants (
    id INT PRIMARY KEY AUTO_INCREMENT,
    conversation_id INT NOT NULL,
    user_id INT NOT NULL,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    role ENUM('admin', 'member') DEFAULT 'member',
    nickname VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    last_read_message_id INT,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_participant (conversation_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_conversation_id (conversation_id)
);

-- ==========================
-- MESSAGES TABLE
-- ==========================
CREATE TABLE messages (
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
    deleted_at TIMESTAMP NULL,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reply_to_message_id) REFERENCES messages(id) ON DELETE SET NULL,
    INDEX idx_conversation_created (conversation_id, created_at),
    INDEX idx_sender_id (sender_id),
    INDEX idx_created_at (created_at)
);

-- ==========================
-- READ RECEIPTS
-- ==========================
CREATE TABLE message_read_receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    message_id INT NOT NULL,
    user_id INT NOT NULL,
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE KEY unique_read_receipt (message_id, user_id),
    INDEX idx_user_id (user_id),
    INDEX idx_message_id (message_id)
);

-- ==========================
-- FRIENDSHIPS TABLE
-- ==========================
CREATE TABLE friendships (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id1 INT NOT NULL,
    user_id2 INT NOT NULL,
    status ENUM('pending', 'accepted', 'blocked') DEFAULT 'pending',
    action_user_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id1) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id2) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (action_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CHECK (user_id1 < user_id2),
    UNIQUE KEY unique_friendship (user_id1, user_id2),
    INDEX idx_user_id1 (user_id1),
    INDEX idx_user_id2 (user_id2),
    INDEX idx_status (status)
);

-- ==========================
-- USER SETTINGS
-- ==========================
CREATE TABLE user_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL UNIQUE,
    theme ENUM('light', 'dark', 'auto') DEFAULT 'auto',
    language VARCHAR(10) DEFAULT 'en',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    sound_enabled BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- ==========================
-- CONVERSATION SETTINGS
-- ==========================
CREATE TABLE conversation_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT NOT NULL,
    conversation_id INT NOT NULL,
    is_muted BOOLEAN DEFAULT FALSE,
    custom_notifications BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    UNIQUE KEY unique_conversation_setting (user_id, conversation_id)
);

-- =====================================================
-- SAMPLE DATA INSERTIONS
-- =====================================================

-- USERS (with bcrypt hashes for "Prince2005.")
INSERT INTO users (username, email, password_hash, display_name, status) VALUES
('john_doe', 'john@example.com', '$2b$10$l0V7PfnAudHN5lR4F3QDSOLXGx262VOaIO2/6/Vkv8vadBqTSxOc.', 'John Doe', 'online'),
('jane_smith', 'jane@example.com', '$2b$10$l0V7PfnAudHN5lR4F3QDSOLXGx262VOaIO2/6/Vkv8vadBqTSxOc.', 'Jane Smith', 'away'),
('bob_wilson', 'bob@example.com', '$2b$10$l0V7PfnAudHN5lR4F3QDSOLXGx262VOaIO2/6/Vkv8vadBqTSxOc.', 'Bob Wilson', 'busy'),
('alex_k', 'alex@example.com', '$2b$10$l0V7PfnAudHN5lR4F3QDSOLXGx262VOaIO2/6/Vkv8vadBqTSxOc.', 'Alex King', 'online'),
('sara_lee', 'sara@example.com', '$2b$10$l0V7PfnAudHN5lR4F3QDSOLXGx262VOaIO2/6/Vkv8vadBqTSxOc.', 'Sara Lee', 'offline'),
('mike_t', 'mike@example.com', '$2b$10$l0V7PfnAudHN5lR4F3QDSOLXGx262VOaIO2/6/Vkv8vadBqTSxOc.', 'Mike Taylor', 'online');

-- DIRECT CONVERSATION: John & Jane
INSERT INTO conversations (is_group, created_by) VALUES (FALSE, 1);

INSERT INTO conversation_participants (conversation_id, user_id) VALUES
(1, 1),
(1, 2);

INSERT INTO messages (conversation_id, sender_id, content) VALUES
(1, 1, 'Hey Jane, did you finish the design mockup?'),
(1, 2, 'Yes! Just shared it in our team group.'),
(1, 1, 'Perfect, checking it out now.');

-- GROUP CONVERSATION: Project Team (John, Jane, Bob)
INSERT INTO conversations (name, is_group, created_by, description, avatar_url)
VALUES ('Project Team', TRUE, 1, 'Chat for main project coordination', 'avatars/project_team.png');

INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES
(2, 1, 'admin'),
(2, 2, 'member'),
(2, 3, 'member');

INSERT INTO messages (conversation_id, sender_id, content) VALUES
(2, 1, 'Welcome to the Project Team chat! Let’s stay updated here.'),
(2, 2, 'Sounds good! I’ll post daily updates.'),
(2, 3, 'Got it. I’ll share the backend progress soon.');

-- NEW GROUP CONVERSATION: Developers Hub (Alex, Sara, Mike, John)
INSERT INTO conversations (name, is_group, created_by, description, avatar_url)
VALUES ('Developers Hub', TRUE, 4, 'Main discussion space for all developers.', 'avatars/dev_hub.png');

INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES
(3, 4, 'admin'),
(3, 5, 'member'),
(3, 6, 'member'),
(3, 1, 'member');

INSERT INTO messages (conversation_id, sender_id, content) VALUES
(3, 4, 'Hey team, welcome to the Developers Hub!'),
(3, 5, 'Excited to collaborate with you all!'),
(3, 6, 'Same here! Let’s make this productive.'),
(3, 1, 'Glad to join — let’s get started with the sprint planning.');
