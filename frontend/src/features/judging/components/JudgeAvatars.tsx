import { motion } from "framer-motion";
import { getAvatarImagePath } from "../../../shared/constants/avatar";
import { useJudgeBreathing } from "../../../shared/hooks/useJudgeBreathing";
import { useJudgeEntrance } from "../../../shared/hooks/useJudgeEntrance";
import { useJudgeSpeech } from "../../../shared/hooks/useJudgeSpeech";
import { JudgeSpeechBubble } from "./JudgeSpeechBubble";

type ViewMode = "top" | "judging" | "result";

interface JudgeAvatarsProps {
	/** TODO: 将来の画面別表示制御で利用予定。現時点では仕様により常時表示。 */
	viewMode: ViewMode;
	isJudging: boolean;
	isPostModalOpen: boolean;
}

const JUDGE_CONFIG = [
	{ id: "nakao", name: "中尾彬風審査員" },
	{ id: "hiroyuki", name: "ひろゆき風審査員" },
	{ id: "dewi", name: "デヴィ夫人風審査員" },
] as const;

type JudgeId = (typeof JUDGE_CONFIG)[number]["id"];

export function JudgeAvatars({
	// TODO: viewMode別出し分け仕様が有効化されたら利用する
	viewMode: _viewMode,
	isJudging,
	isPostModalOpen,
}: JudgeAvatarsProps) {
	const { hasEntered, variants: entranceVariants } = useJudgeEntrance();
	const { isBreathing, variants: breathingVariants } = useJudgeBreathing({
		hasEntered,
		isSpeaking: isJudging,
	});
	const { currentSpeech, speakingJudge } = useJudgeSpeech({
		isJudging,
		isPostModalOpen,
	});

	return (
		<div
			data-testid="judge-avatars-container"
			className="flex flex-row items-end justify-center gap-4"
		>
			{JUDGE_CONFIG.map((judge) => {
				const isSpeaking = speakingJudge === judge.id;
				const entrance = entranceVariants[judge.id as JudgeId];
				const breathing = breathingVariants[judge.id as JudgeId];
				const shouldUseBreathing = hasEntered && isBreathing;
				const fallbackSpeech =
					isJudging && !currentSpeech && judge.id === "hiroyuki"
						? "..."
						: null;
				const displaySpeech =
					isSpeaking && currentSpeech ? currentSpeech : fallbackSpeech;

				return (
					<div key={judge.id} className="relative flex flex-col items-center">
						{displaySpeech && (
							<JudgeSpeechBubble
								isVisible={Boolean(displaySpeech)}
								text={displaySpeech}
								judgeType={judge.id as JudgeId}
							/>
						)}

						<motion.img
							src={getAvatarImagePath(judge.id as JudgeId, "base")}
							alt={judge.name}
							className="w-20 md:w-32 h-auto"
							initial={entrance.initial}
							animate={shouldUseBreathing ? breathing.keyframes : entrance.animate}
							transition={
								shouldUseBreathing ? breathing.transition : entrance.transition
							}
							draggable={false}
						/>
					</div>
				);
			})}
		</div>
	);
}
