const express = require('express');
const { authenticateToken } = require('../middleware/auth');
const { pool } = require('../config/database');

const router = express.Router();

// Send friend request
router.post('/requests', authenticateToken, async (req, res) => {
  try {
    const { toUserId } = req.body;
    
    if (!toUserId) {
      return res.status(400).json({ 
        success: false, 
        message: 'User ID required' 
      });
    }

    if (toUserId === req.user.id) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cannot send friend request to yourself' 
      });
    }

    const user1 = Math.min(req.user.id, toUserId);
    const user2 = Math.max(req.user.id, toUserId);

    const [existing] = await pool.execute(
      'SELECT id, status FROM friendships WHERE user_id1 = ? AND user_id2 = ?',
      [user1, user2]
    );

    if (existing.length > 0) {
      const friendship = existing[0];
      if (friendship.status === 'pending') {
        return res.status(400).json({ 
          success: false, 
          message: 'Friend request already pending' 
        });
      } else if (friendship.status === 'accepted') {
        return res.status(400).json({ 
          success: false, 
          message: 'Already friends with this user' 
        });
      } else if (friendship.status === 'blocked') {
        return res.status(400).json({ 
          success: false, 
          message: 'Cannot send request to blocked user' 
        });
      }
    }

    await pool.execute(
      'INSERT INTO friendships (user_id1, user_id2, status, action_user_id) VALUES (?, ?, "pending", ?)',
      [user1, user2, req.user.id]
    );

    res.status(201).json({
      success: true,
      message: 'Friend request sent successfully'
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get friend requests (incoming)
router.get('/requests', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT f.*, 
              u1.username as user1_username, u1.display_name as user1_display_name, u1.profile_picture_url as user1_avatar,
              u2.username as user2_username, u2.display_name as user2_display_name, u2.profile_picture_url as user2_avatar
       FROM friendships f
       INNER JOIN users u1 ON f.user_id1 = u1.id
       INNER JOIN users u2 ON f.user_id2 = u2.id
       WHERE (f.user_id1 = ? OR f.user_id2 = ?) 
         AND f.status = 'pending'
         AND f.action_user_id != ?`,
      [req.user.id, req.user.id, req.user.id]
    );

    // Format the response to show the other user's info
    const formattedRequests = requests.map(request => {
      const isUser1 = request.user_id1 === req.user.id;
      return {
        id: request.id,
        otherUser: {
          id: isUser1 ? request.user_id2 : request.user_id1,
          username: isUser1 ? request.user2_username : request.user1_username,
          display_name: isUser1 ? request.user2_display_name : request.user1_display_name,
          profile_picture_url: isUser1 ? request.user2_avatar : request.user1_avatar
        },
        status: request.status,
        created_at: request.created_at
      };
    });

    res.json({
      success: true,
      data: formattedRequests
    });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Accept friend request
router.post('/requests/:id/accept', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.execute(
      'SELECT * FROM friendships WHERE id = ? AND (user_id1 = ? OR user_id2 = ?) AND status = "pending"',
      [req.params.id, req.user.id, req.user.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Friend request not found' 
      });
    }

    await pool.execute(
      'UPDATE friendships SET status = "accepted", action_user_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [req.user.id, req.params.id]
    );

    res.json({
      success: true,
      message: 'Friend request accepted successfully'
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Reject friend request
router.post('/requests/:id/reject', authenticateToken, async (req, res) => {
  try {
    const [requests] = await pool.execute(
      'SELECT * FROM friendships WHERE id = ? AND (user_id1 = ? OR user_id2 = ?) AND status = "pending"',
      [req.params.id, req.user.id, req.user.id]
    );

    if (requests.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Friend request not found' 
      });
    }

    await pool.execute(
      'DELETE FROM friendships WHERE id = ?',
      [req.params.id]
    );

    res.json({
      success: true,
      message: 'Friend request rejected'
    });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Get friends list
router.get('/friends', authenticateToken, async (req, res) => {
  try {
    const [friendships] = await pool.execute(
      `SELECT f.*,
              u1.id as user1_id, u1.username as user1_username, u1.display_name as user1_display_name, u1.profile_picture_url as user1_avatar, u1.status as user1_status,
              u2.id as user2_id, u2.username as user2_username, u2.display_name as user2_display_name, u2.profile_picture_url as user2_avatar, u2.status as user2_status
       FROM friendships f
       INNER JOIN users u1 ON f.user_id1 = u1.id
       INNER JOIN users u2 ON f.user_id2 = u2.id
       WHERE (f.user_id1 = ? OR f.user_id2 = ?) 
         AND f.status = 'accepted'`,
      [req.user.id, req.user.id]
    );

    const friends = friendships.map(friendship => {
      const isUser1 = friendship.user1_id === req.user.id;
      return {
        id: isUser1 ? friendship.user2_id : friendship.user1_id,
        username: isUser1 ? friendship.user2_username : friendship.user1_username,
        display_name: isUser1 ? friendship.user2_display_name : friendship.user1_display_name,
        profile_picture_url: isUser1 ? friendship.user2_avatar : friendship.user1_avatar,
        status: isUser1 ? friendship.user2_status : friendship.user1_status,
        friendship_id: friendship.id,
        friends_since: friendship.updated_at
      };
    });

    res.json({
      success: true,
      data: friends
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Remove friend
router.delete('/friends/:friendId', authenticateToken, async (req, res) => {
  try {
    const { friendId } = req.params;

    const [friendships] = await pool.execute(
      'SELECT id FROM friendships WHERE ((user_id1 = ? AND user_id2 = ?) OR (user_id1 = ? AND user_id2 = ?)) AND status = "accepted"',
      [req.user.id, friendId, friendId, req.user.id]
    );

    if (friendships.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Friendship not found' 
      });
    }

    await pool.execute(
      'DELETE FROM friendships WHERE id = ?',
      [friendships[0].id]
    );

    res.json({
      success: true,
      message: 'Friend removed successfully'
    });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;