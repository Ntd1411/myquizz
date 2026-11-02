const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const { createRequire } = require('node:module')
const base = path.resolve(__dirname, '..')
const localRequire = createRequire(path.join(base, 'package.json'))
const ts = localRequire('typescript')

function load(file, mocks = {}) {
  const code = ts.transpileModule(fs.readFileSync(path.join(base, 'src', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true }
  }).outputText
  const mod = { exports: {} }
  const req = id => {
    if (Object.hasOwn(mocks, id)) return mocks[id]
    if (!id.startsWith('.')) return localRequire(id)
    return load(path.posix.normalize(path.posix.join(path.posix.dirname(file), id)).replace(/\.js$/, '.ts'), mocks)
  }
  new Function('require', 'module', 'exports', code)(req, mod, mod.exports)
  return mod.exports
}

const schema = load('modules/quiz/quiz.schema.ts')

test('choice answers must refer to distinct option IDs; typed answers require text', () => {
  const baseQuestion = { question_text: 'Question?' }
  const choice = { ...baseQuestion, question_type: 'multiple_choice', answer_options: ['A', 'B'], correct_answer: [0] }
  assert.equal(schema.createQuestionSchema.safeParse(choice).success, true)
  for (const bad of [
    { ...choice, answer_options: undefined },
    { ...choice, correct_answer: [999] },
    { ...choice, correct_answer: [0, 1] },
    { ...choice, question_type: 'multiple_select', correct_answer: [0, 0] },
    { ...baseQuestion, question_type: 'short_answer', correct_answer: [0] }
  ]) assert.equal(schema.createQuestionSchema.safeParse(bad).success, false)
  assert.equal(schema.createQuestionSchema.safeParse({
    ...baseQuestion, question_type: 'long_answer', correct_answer: 'Tokyo'
  }).success, true)
})

test('calendar dates reject impossible days and accept leap day', () => {
  assert.equal(schema.dateOnlyQuery.safeParse('2024-02-29').success, true)
  assert.equal(schema.dateOnlyQuery.safeParse('2025-02-29').success, false)
  assert.equal(schema.dateOnlyQuery.safeParse('2026-99-99').success, false)
})

test('500 character quiz description has matching DB migration', () => {
  const quiz = { quiz_name: 'Test quiz', quiz_description: 'a'.repeat(500),
    quiz_language: 'vi', is_public: true, questions: [{
      question_type: 'short_answer', question_text: 'Question?', correct_answer: 'A'
    }] }
  assert.equal(schema.createQuizSchema.safeParse(quiz).success, true)
  assert.equal(schema.createQuizSchema.safeParse({ ...quiz, quiz_description: 'a'.repeat(501) }).success, false)
  const migration = fs.readFileSync(path.join(base, 'src/infrastructure/database/migrations/015_quiz_description.sql'), 'utf8')
  assert.match(migration, /quiz_description TYPE varchar\(500\)/)
})

test('quiz create rolls back metadata when a question insert fails', async () => {
  let rolledBack = false
  const tx = {}
  const repo = {
    insertQuiz: async (_id, _quiz, client) => { assert.equal(client, tx); return { id: 1 } },
    insertQuestions: async (_id, _questions, client) => {
      assert.equal(client, tx)
      throw new Error('question 2 insert failed')
    }
  }
  const service = load('modules/quiz/quiz.service.ts', {
    './quiz.repository.js': { quizRepository: repo },
    '../../infrastructure/database/connection.js': { withTransaction: async fn => {
      try { return await fn(tx) } catch (error) { rolledBack = true; throw error }
    } },
    '../storage/storage.service.js': { assertOwnedUpload: async () => {} }
  })
  await assert.rejects(service.createQuizService(1, {
    quiz_name: 'Test quiz', quiz_language: 'vi', is_public: true,
    questions: [{ question_type: 'short_answer', question_text: 'Question?', correct_answer: 'A', time_limit: 30 }]
  }), /question 2/)
  assert.equal(rolledBack, true)
})

test('uploaded image MIME must match its byte signature', () => {
  class Command {}
  const storage = load('modules/storage/storage.service.ts', {
    '@aws-sdk/client-s3': {
      S3Client: class { send() {} }, PutObjectCommand: Command, DeleteObjectCommand: Command,
      HeadObjectCommand: Command, GetObjectCommand: Command
    },
    '@aws-sdk/s3-request-presigner': { getSignedUrl: async () => '' },
    '../../infrastructure/config/storage.js': { storageConfig: {
      endpoint: 'https://s3.test', region: 'test', credentials: {}, bucket: 'test',
      publicUrl: 'https://assets.test'
    } }
  })
  assert.equal(storage.matchesImageSignature('image/jpeg', Uint8Array.from([0xff, 0xd8, 0xff])), true)
  assert.equal(storage.matchesImageSignature('image/png', Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a
  ])), true)
  assert.equal(storage.matchesImageSignature('image/gif', new TextEncoder().encode('GIF89a')), true)
  assert.equal(storage.matchesImageSignature('image/webp', new TextEncoder().encode('RIFF1234WEBP')), true)
  assert.equal(storage.matchesImageSignature('image/png', new TextEncoder().encode('<script>')), false)
})
