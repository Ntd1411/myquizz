/**
 * Quiz schemas.
 *
 * Three read shapes exist on purpose and must not be merged:
 * - Quiz is the full record with its questions, returned by the detail routes.
 * - QuizCard is the compact card used by home sections and the feed.
 * - QuizSummary is the listing row (search, public profile, /quizzes/me); it is
 *   a QuizCard plus is_public and updated_at, and never carries questions.
 */

import type { SchemaMap } from '../types.js'
import { ref } from '../types.js'

export const quizSchemas: SchemaMap = {
  QuestionInput: {
    type: 'object',
    required: ['question_type', 'question_text', 'correct_answer'],
    properties: {
      question_type: {
        type: 'string',
        enum: ['multiple_choice', 'multiple_select', 'short_answer', 'long_answer']
      },
      question_text: { type: 'string', minLength: 1, maxLength: 200 },
      time_limit: { type: 'number', minimum: 0, default: 30 },
      question_image: { type: 'string', format: 'uri' },
      question_hint: {
        type: 'string',
        maxLength: 255,
        description: 'Optional hint shown to players before they answer.'
      },
      explanation: {
        type: 'string',
        maxLength: 255,
        description: 'Optional explanation revealed with the correct answer.'
      },
      answer_options: {
        type: 'array',
        minItems: 2,
        maxItems: 4,
        items: { type: 'string', minLength: 1, maxLength: 100 }
      },
      correct_answer: {
        description:
          'Indexes into answer_options for choice questions, or the expected text for the answer-typed ones.',
        oneOf: [
          { type: 'array', items: { type: 'integer', minimum: 0 }, minItems: 1 },
          { type: 'string', minLength: 1 }
        ]
      }
    }
  },

  Question: {
    type: 'object',
    properties: {
      id: { type: 'integer' },
      quiz_id: { type: 'integer' },
      question_type: {
        type: 'string',
        enum: ['multiple_choice', 'multiple_select', 'short_answer', 'long_answer']
      },
      question_text: { type: 'string' },
      time_limit: { type: 'integer', example: 30 },
      question_image: { type: 'string', nullable: true },
      question_hint: { type: 'string', nullable: true },
      explanation: { type: 'string', nullable: true },
      answer_options: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            option_text: { type: 'string' }
          }
        }
      },
      correct_answer: {
        oneOf: [
          { type: 'array', items: { type: 'integer' } },
          { type: 'string' }
        ]
      },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
      deleted_at: { type: 'string', format: 'date-time', nullable: true }
    }
  },

  CreateQuizRequest: {
    type: 'object',
    required: ['quiz_name', 'quiz_language', 'is_public', 'questions'],
    properties: {
      quiz_name: { type: 'string', minLength: 3, maxLength: 100 },
      quiz_description: { type: 'string', maxLength: 500 },
      quiz_language: { type: 'string', minLength: 1 },
      quiz_image: { type: 'string', format: 'uri' },
      quiz_category: { type: 'string', maxLength: 50 },
      is_public: { type: 'boolean' },
      questions: {
        type: 'array',
        minItems: 1,
        items: ref('QuestionInput')
      }
    }
  },

  UpdateQuizRequest: {
    type: 'object',
    description: 'Partial quiz update. At least one property should be provided.',
    properties: {
      quiz_name: { type: 'string', minLength: 3, maxLength: 100 },
      quiz_description: { type: 'string', maxLength: 500 },
      quiz_language: { type: 'string', minLength: 1 },
      quiz_image: { type: 'string', format: 'uri' },
      quiz_category: { type: 'string', maxLength: 50 },
      is_public: { type: 'boolean' },
      questions: {
        type: 'array',
        minItems: 1,
        items: ref('QuestionInput')
      }
    }
  },

  Quiz: {
    type: 'object',
    description:
      'Full quiz record, returned with its questions by the detail routes. The author is folded into `owner` exactly as on a card, the counters come from the quizzes table and the questions are ordered by id. The ranking columns stay internal and are never part of this response.',
    properties: {
      id: { type: 'integer' },
      quiz_owner: { type: 'integer' },
      quiz_name: { type: 'string' },
      quiz_description: { type: 'string', nullable: true },
      quiz_language: { type: 'string' },
      quiz_image: { type: 'string', nullable: true },
      quiz_category: { type: 'string', nullable: true },
      is_public: { type: 'boolean' },
      owner: ref('QuizOwner'),
      question_count: { type: 'integer', example: 8 },
      play_count: { type: 'integer', example: 120 },
      deleted_at: { type: 'string', format: 'date-time', nullable: true },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' },
      questions: {
        type: 'array',
        items: ref('Question')
      }
    }
  },

  QuizOwner: {
    type: 'object',
    nullable: true,
    description:
      'Public identity of the quiz author, joined into every card and summary. Null when the author was deleted.',
    properties: {
      id: { type: 'integer', example: 3 },
      fullname: { type: 'string', example: 'Nguyen Van A' },
      avatar: { type: 'string', nullable: true }
    }
  },

  QuizCard: {
    type: 'object',
    description: 'Compact quiz shape used by home sections and feed cards.',
    properties: {
      id: { type: 'integer' },
      quiz_name: { type: 'string' },
      quiz_description: { type: 'string', nullable: true },
      quiz_image: { type: 'string', nullable: true },
      quiz_category: { type: 'string', nullable: true },
      quiz_language: { type: 'string' },
      quiz_owner: { type: 'integer' },
      owner: ref('QuizOwner'),
      question_count: { type: 'integer', example: 8 },
      play_count: { type: 'integer', example: 120 },
      completion_rate: {
        type: 'number',
        format: 'float',
        minimum: 0,
        maximum: 1,
        example: 0.66
      },
      created_at: { type: 'string', format: 'date-time' }
    }
  },

  QuizSummary: {
    type: 'object',
    description:
      'Row shape returned by the listing endpoints (search, public profile, /quizzes/me). Questions are never included here.',
    properties: {
      id: { type: 'integer', example: 42 },
      quiz_owner: { type: 'integer', example: 3 },
      owner: ref('QuizOwner'),
      quiz_name: { type: 'string', example: 'JavaScript Basics' },
      quiz_description: { type: 'string', nullable: true },
      quiz_image: { type: 'string', nullable: true },
      quiz_category: { type: 'string', nullable: true, example: 'Programming' },
      quiz_language: { type: 'string', example: 'en' },
      is_public: { type: 'boolean', example: true },
      question_count: { type: 'integer', example: 8 },
      play_count: { type: 'integer', example: 120 },
      completion_rate: {
        type: 'number',
        format: 'float',
        minimum: 0,
        maximum: 1,
        example: 0.66
      },
      created_at: { type: 'string', format: 'date-time' },
      updated_at: { type: 'string', format: 'date-time' }
    }
  },

  HomeSectionType: {
    type: 'string',
    enum: ['featured', 'continue', 'trending', 'newest', 'category']
  },

  HomeSection: {
    type: 'object',
    properties: {
      section_key: { type: 'string', example: 'featured' },
      title: { type: 'string', example: 'Staff picks' },
      section_type: ref('HomeSectionType'),
      items: {
        type: 'array',
        items: ref('QuizCard')
      }
    }
  }
}
