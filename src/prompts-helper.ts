import * as prompts from 'prompts';

const today = new Date(new Date().setHours(0, 0, 0, 0));
const oneMonthAgo = new Date(new Date(new Date().setMonth(today.getMonth() - 1)).setHours(0, 0,0,0));

const dateValidator = (date: Date) => date > today ? 'Not in the future' : true

export const dateRangeQuestions: prompts.PromptObject[] = [
  {   
    type: 'date',
    name: 'startDate',
    message: 'Start of time range?',
    initial: oneMonthAgo,
    validate: dateValidator
  },
  {
    type: 'date',
    name: 'endDate',
    message: 'End of time range?',
    initial: today,
    validate: dateValidator
  }
];
