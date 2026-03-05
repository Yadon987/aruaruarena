import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState, type FormEvent, type MouseEvent } from "react";
import { DURATION, SCALE } from "../../../shared/constants/animations";
import { useFocusTrap } from "../../../shared/hooks/useFocusTrap";
import { useReducedMotion } from "../../../shared/hooks/useReducedMotion";

interface PostFormModalProps {
	isOpen: boolean;
	onClose: () => void;
	onSubmit: (data: { nickname: string; body: string }) => void;
	isLoading: boolean;
}

/**
 * 投稿フォームモーダル
 */
export function PostFormModal({
	isOpen,
	onClose,
	onSubmit,
	isLoading,
}: PostFormModalProps) {
	const [nickname, setNickname] = useState("");
	const [body, setBody] = useState("");
	const closeButtonRef = useRef<HTMLButtonElement | null>(null);
	const dialogRef = useRef<HTMLDivElement | null>(null);
	const previousActiveElementRef = useRef<HTMLElement | null>(null);
	const prefersReducedMotion = useReducedMotion();

	useFocusTrap({
		isActive: isOpen,
		containerRef: dialogRef,
		onEscape: onClose,
	});

	useEffect(() => {
		if (isOpen) {
			previousActiveElementRef.current = document.activeElement as HTMLElement;
			closeButtonRef.current?.focus();
			return;
		}

		setNickname("");
		setBody("");
		previousActiveElementRef.current?.focus();
		previousActiveElementRef.current = null;
	}, [isOpen]);

	const handleSubmit = (event: FormEvent) => {
		event.preventDefault();
		onSubmit({ nickname, body });
	};

	const handleBackdropClick = () => {
		onClose();
	};

	const handleDialogClick = (event: MouseEvent) => {
		event.stopPropagation();
	};

	return (
		<AnimatePresence>
			{isOpen && (
				<div className="fixed inset-0 z-50">
					<button
						type="button"
						data-testid="modal-overlay"
						aria-label="モーダル背景"
						className="absolute inset-0 bg-black/60"
						onClick={handleBackdropClick}
					/>

					<div className="relative flex h-full items-center justify-center p-4">
						<motion.div
							ref={dialogRef}
							role="dialog"
							aria-modal="true"
							aria-label="投稿フォーム"
							initial={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
							animate={prefersReducedMotion ? {} : { opacity: 1, scale: SCALE.NORMAL }}
							exit={prefersReducedMotion ? {} : { opacity: 0, scale: SCALE.SHRUNK }}
							transition={{ duration: DURATION.MODAL }}
							className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl"
							onClick={handleDialogClick}
						>
							<div className="mb-4 flex items-center justify-between">
								<h2 className="text-lg font-semibold">投稿する</h2>
								<button
									ref={closeButtonRef}
									type="button"
									onClick={onClose}
									className="text-gray-500 hover:text-gray-700"
								>
									閉じる
								</button>
							</div>

							<form
								aria-label="投稿フォーム"
								onSubmit={handleSubmit}
								className="space-y-4"
							>
								<div>
									<label htmlFor="nickname" className="block text-sm font-medium">
										ニックネーム
									</label>
									<input
										id="nickname"
										type="text"
										value={nickname}
										onChange={(event) => setNickname(event.target.value)}
										className="mt-1 w-full rounded border px-3 py-2"
									/>
								</div>

								<div>
									<label htmlFor="body" className="block text-sm font-medium">
										あるある
									</label>
									<textarea
										id="body"
										value={body}
										onChange={(event) => setBody(event.target.value)}
										className="mt-1 w-full rounded border px-3 py-2"
										rows={3}
									/>
								</div>

								<button
									type="submit"
									disabled={isLoading}
									className="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 disabled:bg-gray-300"
								>
									{isLoading ? "投稿中..." : "投稿"}
								</button>
							</form>
						</motion.div>
					</div>
				</div>
			)}
		</AnimatePresence>
	);
}
