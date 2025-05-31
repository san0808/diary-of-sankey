# Contributing to Diary of Sankey

Thank you for your interest in contributing to Diary of Sankey! This document provides guidelines for contributing to this Notion-powered blog system.

## 🤝 How to Contribute

### Reporting Issues
- Use GitHub Issues to report bugs or request features
- Check existing issues before creating new ones
- Provide clear descriptions and reproduction steps

### Development Workflow

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/san0808/diary-of-sankey.git
   cd diary-of-sankey
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Create a feature branch**
   ```bash
   git checkout -b feat/your-feature-name
   ```

5. **Make your changes**
   - Follow the existing code style
   - Add tests for new functionality
   - Update documentation as needed

6. **Test your changes**
   ```bash
   npm test
   npm run build
   ```

7. **Commit using conventional commits**
   ```bash
   git commit -m "feat: add new feature description"
   ```

8. **Push and create a pull request**

## 📝 Commit Convention

Use conventional commits for clear history:

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting, etc.)
- `refactor:` - Code refactoring
- `test:` - Adding or updating tests
- `chore:` - Maintenance tasks

## 🎨 Design Philosophy

When contributing design changes:

- **Preserve the original aesthetic** - The orange theme and serif fonts are core to the design
- **Follow minimalist principles** - Use subtle grays for code blocks and UI elements
- **Maintain Notion-inspired styling** - Keep the clean, readable aesthetics
- **Test responsiveness** - Ensure changes work on mobile and desktop

## 🧪 Testing

- Write tests for new functionality
- Ensure all existing tests pass
- Test with real Notion content when possible
- Verify the build process works correctly

## 📚 Documentation

- Update README.md for new features
- Add examples to docs/ directory
- Include JSDoc comments for new functions
- Update the writing workflow docs if needed

## 🔍 Code Review

Pull requests will be reviewed for:

- Code quality and style consistency
- Test coverage
- Documentation updates
- Design philosophy adherence
- Performance impact

## 🚀 Release Process

Releases follow semantic versioning:
- `major.minor.patch`
- Breaking changes increment major version
- New features increment minor version
- Bug fixes increment patch version

## 💡 Ideas for Contributions

- **New Notion block support** - Add processors for additional Notion block types
- **Performance improvements** - Optimize build times or site performance
- **Accessibility enhancements** - Improve screen reader support
- **SEO improvements** - Enhance search engine optimization
- **Documentation** - Improve guides and examples
- **Testing** - Add more comprehensive test coverage

## 📞 Getting Help

- Open an issue for questions
- Check existing documentation first
- Be specific about your environment and steps taken

## 🎯 Goals

This project aims to:
- Provide the best Notion-to-blog experience
- Maintain beautiful, fast, accessible websites
- Keep the setup process simple and reliable
- Preserve the elegant design aesthetic

Thank you for contributing! 🚀 