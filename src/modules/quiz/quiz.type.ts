// export interface Quiz {
//   id: number;
//   quiz_owner: string;
//   quiz_name: string;
//   quiz_description: string;
//   quiz_language: string;
//   quiz_image: string;
//   quiz_category: string;
//   is_public: boolean;
//   deleted_at: string | null;
//   created_at: string;
//   updated_at: string;
//   questions?: Question[];
// }

// export interface Question {
//   id: number;
//   quiz_id: number;
//   question_type:
//     | 'multiple_choice'
//     | 'multiple_select'
//     | 'short_answer'
//     | 'long_answer';
//   question_text: string;
//   question_image: string | null;
//   answer_options: Answer[] | null; // Can be null for short/long answer questions
//   correct_answer: Answer | Answer[]; // Can be a string for short/long answer or an array of strings for multiple choice/select
//   deleted_at: string | null;
//   created_at: string;
//   updated_at: string;
// }

// export interface Answer {
//   id: number;
//   text: string;
//   hint?: string;
//   explanation?: string;
// }
