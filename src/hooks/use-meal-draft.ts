import { useRef, useState, useEffect, useSyncExternalStore, type SetStateAction } from "react";
import { useApp, usePatientStore } from "@/lib/app-context";
import { draftHasError, draftStatus } from "@/lib/data/meal-draft";

const subscribe = (callback: () => void) => {
  window.addEventListener("glycare-draft-status", callback);
  return () => window.removeEventListener("glycare-draft-status", callback);
};
export function useMealDraftError() {
  const scope = useMealDraftScope();
  return useSyncExternalStore(
    subscribe,
    () => draftHasError(scope),
    () => false,
  );
}

export function useMealDraftScope() {
  const { session } = useApp();
  const { mode, pid } = usePatientStore();
  return `${mode}:${session?.user.id ?? "demo"}:${pid}`;
}

export function useMealDraftState<T>(field: string, initial: T | (() => T)) {
  const scope = useMealDraftScope();
  const { store, readOnly } = usePatientStore();
  const [error, setError] = useState(false);
  const [value, setValue] = useState<T>(() => {
    const fallback = () => (typeof initial === "function" ? (initial as () => T)() : initial);
    if (readOnly) return fallback();
    try {
      const draft = store.readMealDraft(scope);
      return Object.hasOwn(draft, field) ? (draft[field] as T) : fallback();
    } catch {
      queueMicrotask(() => draftStatus(scope, true));
      return fallback();
    }
  });
  const current = useRef(value);
  useEffect(() => {
    if (readOnly) return;
    try {
      if (!Object.hasOwn(store.readMealDraft(scope), field))
        store.writeMealDraft(scope, field, current.current);
    } catch {
      draftStatus(scope, true);
    }
  }, [scope, field, store, readOnly]);
  function update(action: SetStateAction<T>) {
    const next = typeof action === "function" ? (action as (v: T) => T)(current.current) : action;
    current.current = next;
    if (!readOnly) {
      try {
        store.writeMealDraft(scope, field, next);
        setError(false);
        draftStatus(scope, false);
      } catch {
        setError(true);
        draftStatus(scope, true);
      }
    }
    setValue(next);
  }
  return [value, update, error] as const;
}
