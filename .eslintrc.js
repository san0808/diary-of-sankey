module.exports = {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'commonjs'
  },
  rules: {
    'no-unused-vars': 'warn',
    'no-console': 'off', // Allow console in Node.js
    'prefer-const': 'error',
    'no-var': 'error'
  }
}; 