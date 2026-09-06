import type {
  LogicOperator,
  LogicCondition,
  LogicConditionGroup,
  SkipRule,
  DisplayRule,
  BranchRule,
  Question,
  SurveyPage,
} from '@/types';

export type AnswerMap = Record<string, any>;

const NUMERIC_OPERATORS: LogicOperator[] = [
  'greater_than',
  'less_than',
  'greater_equal',
  'less_equal',
];

export function evaluateCondition(
  condition: LogicCondition,
  answer: any,
): boolean {
  const val = condition.value;

  switch (condition.operator) {
    case 'equals': {
      if (Array.isArray(answer)) return answer.includes(val);
      return answer != null && String(answer) === String(val);
    }
    case 'not_equals': {
      if (Array.isArray(answer)) return !answer.includes(val);
      return answer != null && String(answer) !== String(val);
    }
    case 'contains': {
      if (Array.isArray(answer)) return answer.some((a) => String(a).includes(val));
      return answer != null && String(answer).includes(val);
    }
    case 'starts_with': {
      if (Array.isArray(answer)) return answer.some((a) => String(a).startsWith(val));
      return answer != null && String(answer).startsWith(val);
    }
    case 'ends_with': {
      if (Array.isArray(answer)) return answer.some((a) => String(a).endsWith(val));
      return answer != null && String(answer).endsWith(val);
    }
    case 'greater_than': {
      if (answer == null || answer === '') return false;
      return Number(answer) > Number(val);
    }
    case 'less_than': {
      if (answer == null || answer === '') return false;
      return Number(answer) < Number(val);
    }
    case 'greater_equal': {
      if (answer == null || answer === '') return false;
      return Number(answer) >= Number(val);
    }
    case 'less_equal': {
      if (answer == null || answer === '') return false;
      return Number(answer) <= Number(val);
    }
    case 'is_empty': {
      if (answer == null) return true;
      if (Array.isArray(answer)) return answer.length === 0;
      if (typeof answer === 'object') return Object.keys(answer).length === 0;
      return answer === '';
    }
    case 'is_not_empty': {
      if (answer == null) return false;
      if (Array.isArray(answer)) return answer.length > 0;
      if (typeof answer === 'object') return Object.keys(answer).length > 0;
      return answer !== '';
    }
    default:
      return false;
  }
}

export function evaluateConditionGroup(
  group: LogicConditionGroup,
  answers: AnswerMap,
): boolean {
  if (!group.conditions || group.conditions.length === 0) return true;

  const results = group.conditions.map((cond) => {
    const answer = answers[cond.sourceQuestionId];
    return evaluateCondition(cond, answer);
  });

  if (group.connector === 'and') {
    return results.every(Boolean);
  }
  return results.some(Boolean);
}

/** Evaluate a legacy SkipRule (single condition) or new compound rule */
export function evaluateSkipRule(rule: SkipRule, answers: AnswerMap): boolean {
  if (rule.conditionGroup) {
    return evaluateConditionGroup(rule.conditionGroup, answers);
  }
  // Legacy single-condition path
  const answer = answers[rule.sourceQuestionId];
  return evaluateCondition(
    { id: rule.id, sourceQuestionId: rule.sourceQuestionId, operator: rule.operator, value: rule.value },
    answer,
  );
}

/** Find skip target page from a page's questions */
export function evaluateSkipRules(
  page: SurveyPage,
  answers: AnswerMap,
): string | null {
  for (const question of page.questions) {
    if (!question.skipRules || question.skipRules.length === 0) continue;
    for (const rule of question.skipRules) {
      if (evaluateSkipRule(rule, answers)) {
        return rule.targetPageId;
      }
    }
  }
  return null;
}

/** Check if a question should be displayed based on its display rule */
export function shouldDisplayQuestion(
  question: Question,
  answers: AnswerMap,
): boolean {
  if (!question.displayRule) return true;
  return evaluateConditionGroup(question.displayRule.conditionGroup, answers);
}

/** Filter questions on a page, hiding those whose display rules don't pass */
export function getVisibleQuestions(
  page: SurveyPage,
  answers: AnswerMap,
): Question[] {
  return page.questions.filter((q) => shouldDisplayQuestion(q, answers));
}

/** Evaluate branch rules for sections to find which section to route to */
export function evaluateBranchRules(
  branchRules: BranchRule[],
  answers: AnswerMap,
): string | null {
  for (const rule of branchRules) {
    if (evaluateConditionGroup(rule.conditionGroup, answers)) {
      return rule.targetPageId;
    }
  }
  return null;
}

/** Get all operators with labels for UI */
export const LOGIC_OPERATORS: { value: LogicOperator; label: string }[] = [
  { value: 'equals', label: 'equals' },
  { value: 'not_equals', label: 'does not equal' },
  { value: 'contains', label: 'contains' },
  { value: 'starts_with', label: 'starts with' },
  { value: 'ends_with', label: 'ends with' },
  { value: 'greater_than', label: 'is greater than' },
  { value: 'less_than', label: 'is less than' },
  { value: 'greater_equal', label: 'is greater than or equal to' },
  { value: 'less_equal', label: 'is less than or equal to' },
  { value: 'is_empty', label: 'is empty' },
  { value: 'is_not_empty', label: 'is not empty' },
];

export function getOperatorLabel(op: LogicOperator): string {
  return LOGIC_OPERATORS.find((o) => o.value === op)?.label || op;
}

/** Check if an operator needs a value input (is_empty / is_not_empty don't) */
export function operatorNeedsValue(op: LogicOperator): boolean {
  return op !== 'is_empty' && op !== 'is_not_empty';
}

/** Check if an operator is numeric (for showing number vs text input) */
export function isNumericOperator(op: LogicOperator): boolean {
  return NUMERIC_OPERATORS.includes(op);
}
