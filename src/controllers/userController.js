const bcrypt = require('bcrypt');
const SALT_ROUNDS = 12;

function changePassword(db) {
  return async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user.id;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: 'Old password and new password are required' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters' });
    }

    try {
      // Get current user password hash from db
      const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Compare old password
      const match = await bcrypt.compare(oldPassword, user.password_hash);
      if (!match) {
        return res.status(400).json({ error: 'Incorrect old password' });
      }

      // Hash new password
      const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

      // Update password hash in db
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

      res.json({ message: 'Password updated successfully' });
    } catch (error) {
      console.error('Error changing password:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
}

module.exports = {
  changePassword
};
