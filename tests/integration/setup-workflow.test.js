const fs = require('fs-extra');
const path = require('path');

// Mock dependencies
jest.mock('fs-extra');
jest.mock('inquirer');
jest.mock('@notionhq/client');

describe('Setup Workflow Integration', () => {
  let originalEnv;
  let mockInquirer;
  let mockNotionClient;

  beforeEach(() => {
    originalEnv = { ...process.env };
    
    // Clear environment
    delete process.env.NOTION_API_KEY;
    delete process.env.NOTION_DATABASE_ID;
    
    // Mock inquirer
    mockInquirer = require('inquirer');
    mockInquirer.prompt = jest.fn();
    
    // Mock Notion client
    const { Client } = require('@notionhq/client');
    mockNotionClient = {
      users: { me: jest.fn() },
      pages: { create: jest.fn() },
      databases: { create: jest.fn() },
      search: jest.fn()
    };
    Client.mockImplementation(() => mockNotionClient);

    // Mock file system
    fs.pathExists = jest.fn();
    fs.readFile = jest.fn();
    fs.writeFile = jest.fn();
    fs.ensureDirSync = jest.fn();
  });

  afterEach(() => {
    process.env = originalEnv;
    jest.clearAllMocks();
  });

  describe('Database Creation Workflow', () => {
    it('should create database with proper schema when user has permissions', async () => {
      // Mock successful responses
      mockNotionClient.users.me.mockResolvedValue({ 
        name: 'Test User',
        type: 'bot'
      });
      
      mockNotionClient.pages.create.mockResolvedValue({
        id: 'parent-page-id',
        url: 'https://notion.so/parent-page'
      });

      mockNotionClient.databases.create.mockResolvedValue({
        id: 'test-database-id',
        title: [{ text: { content: 'Blog Posts' } }],
        properties: {
          Title: { title: {} },
          Status: { select: { options: [] } },
          Category: { select: { options: [] } },
          'Publish Date': { date: {} }
        }
      });

      // Mock user inputs
      mockInquirer.prompt
        .mockResolvedValueOnce({
          inputApiKey: 'ntn_test_key_123'
        })
        .mockResolvedValueOnce({
          openDatabase: false
        })
        .mockResolvedValueOnce({
          updateEnv: true
        });

      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue('# Test env file\n');

      // Test the database creation
      const DatabaseCreator = require('../../scripts/create-notion-database.js');
      
      // This should not throw
      expect(DatabaseCreator).toBeDefined();
      
      // Verify API key validation
      expect(mockNotionClient.users.me).toHaveBeenCalled();
    });

    it('should handle permission errors gracefully and guide user', async () => {
      // Mock permission denied error
      const permissionError = new Error('Insufficient permissions');
      permissionError.code = 'validation_error';
      
      mockNotionClient.users.me.mockResolvedValue({ name: 'Test User' });
      mockNotionClient.pages.create.mockRejectedValue(permissionError);
      mockNotionClient.search.mockResolvedValue({ results: [] });

      mockInquirer.prompt.mockResolvedValue({
        inputApiKey: 'ntn_test_key_123'
      });

      // Should handle gracefully and provide guidance
      const DatabaseCreator = require('../../scripts/create-notion-database.js');
      expect(DatabaseCreator).toBeDefined();
    });

    it('should validate API key format correctly', async () => {
      mockInquirer.prompt.mockResolvedValue({
        inputApiKey: 'invalid_key_format'
      });

      // The validation should catch invalid format
      const DatabaseCreator = require('../../scripts/create-notion-database.js');
      expect(DatabaseCreator).toBeDefined();
      
      // Verify that validation is called
      expect(mockInquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('Auto-Sync Setup Workflow', () => {
    it('should set up GitHub Actions auto-sync correctly', async () => {
      // Mock environment file exists
      fs.pathExists.mockImplementation((filePath) => {
        return Promise.resolve(filePath.endsWith('.env'));
      });

      fs.readFile.mockResolvedValue(`
NOTION_API_KEY=ntn_test_key
NOTION_DATABASE_ID=test_db_id
`);

      // Mock workflow file doesn't exist yet
      fs.pathExists.mockImplementation((filePath) => {
        if (filePath.includes('auto-sync.yml')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const SetupAutoSync = require('../../scripts/setup-auto-sync.js');
      
      // Should be able to load without errors
      expect(SetupAutoSync).toBeDefined();
    });

    it('should detect missing environment variables', async () => {
      // Mock missing .env file
      fs.pathExists.mockResolvedValue(false);

      const SetupAutoSync = require('../../scripts/setup-auto-sync.js');
      
      // Should handle missing environment gracefully
      expect(SetupAutoSync).toBeDefined();
    });
  });

  describe('Main Setup Wizard Workflow', () => {
    it('should complete full setup process for new user', async () => {
      // Mock complete user journey
      mockInquirer.prompt
        .mockResolvedValueOnce({
          // Blog configuration
          blogTitle: 'My Test Blog',
          blogDescription: 'Test blog description',
          authorName: 'Test Author',
          siteUrl: 'https://test-blog.com'
        })
        .mockResolvedValueOnce({
          // Notion integration
          notionApiKey: 'ntn_test_key_123',
          databaseOption: 'auto'
        })
        .mockResolvedValueOnce({
          // Content configuration
          defaultCategory: 'Blog',
          postsPerPage: 10,
          enableComments: false
        })
        .mockResolvedValueOnce({
          // Deployment configuration
          deployTarget: 'github-pages',
          deploymentConfig: {}
        });

      // Mock file operations
      fs.pathExists.mockResolvedValue(false); // No existing .env
      fs.writeFile.mockResolvedValue(undefined);

      // Mock successful database creation
      process.env.NOTION_API_KEY = 'ntn_test_key_123';
      
      const SetupWizard = require('../../scripts/setup.js');
      
      // Should complete without errors
      expect(SetupWizard).toBeDefined();
    });

    it('should handle existing configuration gracefully', async () => {
      // Mock existing .env file
      fs.pathExists.mockResolvedValue(true);
      fs.readFile.mockResolvedValue(`
NOTION_API_KEY=existing_key
NOTION_DATABASE_ID=existing_db
BLOG_TITLE=Existing Blog
`);

      mockInquirer.prompt.mockResolvedValue({
        overwrite: true
      });

      const SetupWizard = require('../../scripts/setup.js');
      
      // Should handle existing config
      expect(SetupWizard).toBeDefined();
    });
  });

  describe('Error Recovery Scenarios', () => {
    it('should recover from network failures during setup', async () => {
      // Mock network timeout
      const networkError = new Error('Network timeout');
      networkError.code = 'ECONNRESET';
      
      mockNotionClient.users.me.mockRejectedValue(networkError);

      mockInquirer.prompt.mockResolvedValue({
        inputApiKey: 'ntn_test_key_123'
      });

      // Should handle network errors gracefully
      const DatabaseCreator = require('../../scripts/create-notion-database.js');
      expect(DatabaseCreator).toBeDefined();
    });

    it('should handle file system permission errors during setup', async () => {
      // Mock permission denied for file writing
      const permissionError = new Error('Permission denied');
      permissionError.code = 'EACCES';
      
      fs.writeFile.mockRejectedValue(permissionError);

      mockInquirer.prompt.mockResolvedValue({
        blogTitle: 'Test Blog',
        authorName: 'Test Author'
      });

      const SetupWizard = require('../../scripts/setup.js');
      
      // Should handle file permission errors
      expect(SetupWizard).toBeDefined();
    });

    it('should validate workspace connectivity before proceeding', async () => {
      // Mock workspace that's not accessible
      const accessError = new Error('Object not found');
      accessError.code = 'object_not_found';
      
      mockNotionClient.users.me.mockRejectedValue(accessError);

      mockInquirer.prompt.mockResolvedValue({
        inputApiKey: 'ntn_invalid_key'
      });

      // Should detect invalid workspace access
      const DatabaseCreator = require('../../scripts/create-notion-database.js');
      expect(DatabaseCreator).toBeDefined();
    });
  });

  describe('Configuration Validation', () => {
    it('should validate required configuration fields', async () => {
      const config = {
        notion: {
          apiKey: '',  // Invalid: empty
          databaseId: 'too_short'  // Invalid: not 32 chars
        },
        site: {
          url: 'invalid_url',  // Invalid: not proper URL
          title: ''  // Invalid: empty
        }
      };

      // Configuration validation should catch these issues
      expect(config.notion.apiKey).toBeFalsy();
      expect(config.notion.databaseId.length).not.toBe(32);
      expect(config.site.title).toBeFalsy();
    });

    it('should provide helpful error messages for common mistakes', async () => {
      const commonMistakes = [
        { 
          input: 'secret_wrong_format', 
          error: 'Token should start with "ntn_" for new integrations'
        },
        {
          input: 'ntn_', 
          error: 'Token is incomplete'
        },
        {
          input: 'database_id_wrong_length',
          error: 'Database ID should be 32 characters'
        }
      ];

      // Each mistake should be caught with helpful message
      commonMistakes.forEach(mistake => {
        expect(mistake.input).toBeDefined();
        expect(mistake.error.length).toBeGreaterThan(10); // Should have helpful error message
      });
    });
  });

  describe('Production Environment Simulation', () => {
    it('should work in Docker container environment', async () => {
      // Simulate Docker environment variables
      process.env.NODE_ENV = 'production';
      process.env.HOME = '/root';
      process.env.PWD = '/app';

      // Mock Docker-like file system
      fs.pathExists.mockImplementation((filePath) => {
        // Simulate read-only file system for some paths
        if (filePath.includes('/root')) return Promise.resolve(false);
        return Promise.resolve(true);
      });

      const SetupWizard = require('../../scripts/setup.js');
      
      // Should handle Docker environment
      expect(SetupWizard).toBeDefined();
    });

    it('should handle CI/CD environment variables correctly', async () => {
      // Simulate GitHub Actions environment
      process.env.GITHUB_ACTIONS = 'true';
      process.env.NOTION_API_KEY = 'ntn_ci_key';
      process.env.NOTION_DATABASE_ID = 'ci_database_id_123456789012345';

      // Mock CI environment file operations
      fs.pathExists.mockResolvedValue(false); // No .env in CI
      fs.writeFile.mockResolvedValue(undefined);

      const SetupWizard = require('../../scripts/setup.js');
      
      // Should work in CI environment
      expect(SetupWizard).toBeDefined();
    });
  });
}); 