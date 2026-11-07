export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-empty': [2, 'never'],
    'scope-case': [0],
    'subject-case': [0],
    'subject-full-stop': [0],
    'body-leading-blank': [0],
    'body-max-line-length': [0],
    'footer-leading-blank': [0],
    'footer-max-line-length': [0],
  },
};
