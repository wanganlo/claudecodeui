import express from 'express';
import { userDb, userPreferencesDb } from '../modules/database/index.js';
import { authenticateToken } from '../middleware/auth.js';
import { getSystemGitConfig } from '../utils/gitConfig.js';
import { spawn } from 'child_process';

const router = express.Router();

function readJsonBody(req) {
  try {
    return req.body && typeof req.body === 'object' ? req.body : {};
  } catch {
    return {};
  }
}

function spawnAsync(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { ...options, shell: false });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (data) => { stdout += data.toString(); });
    child.stderr.on('data', (data) => { stderr += data.toString(); });
    child.on('error', (error) => { reject(error); });
    child.on('close', (code) => {
      if (code === 0) { resolve({ stdout, stderr }); return; }
      const error = new Error(`Command failed: ${command} ${args.join(' ')}`);
      error.code = code;
      error.stdout = stdout;
      error.stderr = stderr;
      reject(error);
    });
  });
}

router.get('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId === undefined || userId === null) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const preferences = userPreferencesDb.getPreferences(Number(userId));
    res.json({
      success: true,
      preferences,
      scopeAll: req.user?.scopeAll ?? false,
    });
  } catch (error) {
    console.error('Error getting user preferences:', error);
    res.status(500).json({ error: 'Failed to get user preferences' });
  }
});

router.put('/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user?.id;
    if (userId === undefined || userId === null) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (req.user?.is_admin !== 1) {
      return res.status(403).json({ error: 'Admin privileges required' });
    }
    const body = readJsonBody(req);
    const { superadmin_view } = body;
    if (typeof superadmin_view !== 'boolean') {
      return res.status(400).json({ error: 'superadmin_view must be a boolean' });
    }
    const preferences = userPreferencesDb.setPreference(Number(userId), 'superadmin_view', superadmin_view);
    res.json({
      success: true,
      preferences,
      scopeAll: req.user?.is_admin === 1 && preferences.superadmin_view,
    });
  } catch (error) {
    console.error('Error setting user preferences:', error);
    res.status(500).json({ error: 'Failed to set user preferences' });
  }
});

router.get('/git-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    let gitConfig = userDb.getGitConfig(userId);

    // If database is empty, try to get from system git config
    if (!gitConfig || (!gitConfig.git_name && !gitConfig.git_email)) {
      const systemConfig = await getSystemGitConfig();

      // If system has values, save them to database for this user
      if (systemConfig.git_name || systemConfig.git_email) {
        userDb.updateGitConfig(userId, systemConfig.git_name, systemConfig.git_email);
        gitConfig = systemConfig;
        console.log(`Auto-populated git config from system for user ${userId}: ${systemConfig.git_name} <${systemConfig.git_email}>`);
      }
    }

    res.json({
      success: true,
      gitName: gitConfig?.git_name || null,
      gitEmail: gitConfig?.git_email || null
    });
  } catch (error) {
    console.error('Error getting git config:', error);
    res.status(500).json({ error: 'Failed to get git configuration' });
  }
});

// Apply git config globally via git config --global
router.post('/git-config', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { gitName, gitEmail } = req.body;

    if (!gitName || !gitEmail) {
      return res.status(400).json({ error: 'Git name and email are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(gitEmail)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    userDb.updateGitConfig(userId, gitName, gitEmail);

    try {
      await spawnAsync('git', ['config', '--global', 'user.name', gitName]);
      await spawnAsync('git', ['config', '--global', 'user.email', gitEmail]);
      console.log(`Applied git config globally: ${gitName} <${gitEmail}>`);
    } catch (gitError) {
      console.error('Error applying git config:', gitError);
    }

    res.json({
      success: true,
      gitName,
      gitEmail
    });
  } catch (error) {
    console.error('Error updating git config:', error);
    res.status(500).json({ error: 'Failed to update git configuration' });
  }
});

router.post('/complete-onboarding', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    userDb.completeOnboarding(userId);

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Error completing onboarding:', error);
    res.status(500).json({ error: 'Failed to complete onboarding' });
  }
});

router.get('/onboarding-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const hasCompleted = userDb.hasCompletedOnboarding(userId);

    res.json({
      success: true,
      hasCompletedOnboarding: hasCompleted
    });
  } catch (error) {
    console.error('Error checking onboarding status:', error);
    res.status(500).json({ error: 'Failed to check onboarding status' });
  }
});

export default router;
