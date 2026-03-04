import { AnimatePresence, motion } from "framer-motion";

export type JudgeType = "hiroyuki" | "dewi" | "nakao";

interface JudgeSpeechBubbleProps {
	isVisible: boolean;
	text: string;
	judgeType: JudgeType;
}

const POSITION_CLASSES: Record<JudgeType, string> = {
	hiroyuki: "justify-center",
	dewi: "justify-center",
	nakao: "justify-start",
};

export function JudgeSpeechBubble({
	isVisible,
	text,
	judgeType,
}: JudgeSpeechBubbleProps) {
	return (
		<AnimatePresence>
			{isVisible && (
				<motion.div
					role="status"
					aria-live="polite"
					initial={{ opacity: 0, y: 10 }}
					animate={{ opacity: 1, y: 0 }}
					exit={{ opacity: 0, y: 10 }}
					className={`flex ${POSITION_CLASSES[judgeType]} mb-2 whitespace-normal rounded-lg bg-white px-3 py-2 text-sm shadow-md`}
				>
					{text}
				</motion.div>
			)}
		</AnimatePresence>
	);
}
