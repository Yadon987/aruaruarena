import { useEffect, type RefObject } from "react";

interface UseFocusTrapOptions {
	isActive: boolean;
	containerRef: RefObject<HTMLElement | null>;
	onEscape: () => void;
}

/**
 * モーダル向けのフォーカストラップを提供するフック
 */
export function useFocusTrap({
	isActive,
	containerRef,
	onEscape,
}: UseFocusTrapOptions): void {
	useEffect(() => {
		if (!isActive) {
			return;
		}

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.preventDefault();
				onEscape();
				return;
			}

			if (event.key !== "Tab" || !containerRef.current) {
				return;
			}

			const focusableElements = containerRef.current.querySelectorAll<HTMLElement>(
				'button:not([disabled]), a[href]:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"]):not([disabled])',
			);

			if (focusableElements.length === 0) {
				event.preventDefault();
				return;
			}

			const firstElement = focusableElements[0];
			const lastElement = focusableElements[focusableElements.length - 1];
			const activeElement = document.activeElement;

			if (event.shiftKey && activeElement === firstElement) {
				event.preventDefault();
				lastElement.focus();
			} else if (!event.shiftKey && activeElement === lastElement) {
				event.preventDefault();
				firstElement.focus();
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [isActive, containerRef, onEscape]);
}
