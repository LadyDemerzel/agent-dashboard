export const SHORT_FORM_PROJECT_OPTIMISTIC_UPDATE_EVENT = "short-form-project-optimistic-update";

export interface ShortFormProjectOptimisticUpdateDetail {
  projectId: string;
  soundDesignPending?: boolean;
  soundDesignStatus?: string;
}

export function dispatchShortFormProjectOptimisticUpdate(
  detail: ShortFormProjectOptimisticUpdateDetail,
) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<ShortFormProjectOptimisticUpdateDetail>(
      SHORT_FORM_PROJECT_OPTIMISTIC_UPDATE_EVENT,
      { detail },
    ),
  );
}
