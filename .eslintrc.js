module.exports = {
  env: {
    browser: true,
    es2021: true,
  },
  extends: ['eslint:recommended'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
  },
  rules: {
    'no-unused-vars': ['warn'],
    'no-console': 'off',
    'no-multiple-empty-lines': ['error', { max: 1 }],
    'comma-dangle': ['error', 'always-multiline'],
  },
}; 