"use client";

import { useEffect, type RefObject } from "react";

const INVALID_FIELD_SELECTOR = '[aria-invalid="true"]';
const FORM_ALERT_SELECTOR = '[role="alert"]';

/** The only part of a form state this hook needs. */
type FormStateWithStatus = {
  status: string;
};

/**
 * After a failed submit, moves keyboard focus to the first invalid field of
 * the form, or to the form's error alert when no single field is to blame.
 *
 * Why: the submit button is disabled while the request is pending, so the
 * browser drops focus to `<body>`. Without this, keyboard and screen-reader
 * users would have to search the page to find what went wrong.
 *
 * The alert must have `tabIndex={-1}` so it can receive focus. The effect
 * re-runs for every new state object, i.e. once per submit.
 */
export function useFocusOnFormError(
  formRef: RefObject<HTMLFormElement | null>,
  state: FormStateWithStatus,
): void {
  useEffect(() => {
    if (state.status !== "error") {
      return;
    }
    const form = formRef.current;
    if (!form) {
      return;
    }
    const firstInvalidField = form.querySelector<HTMLElement>(INVALID_FIELD_SELECTOR);
    const formAlert = form.querySelector<HTMLElement>(FORM_ALERT_SELECTOR);
    const focusTarget = firstInvalidField ?? formAlert;
    focusTarget?.focus();
  }, [formRef, state]);
}
