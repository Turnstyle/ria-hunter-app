/* eslint-disable */
export default {
  displayName: 'supabase',
  preset: '../../jest.preset.js',
  transform: {
    '^.+\\\\.[tj]s$': ['@swc/jest', { jsc: { transform: { react: { runtime: 'automatic' } } } }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../coverage/libs/supabase',
};
