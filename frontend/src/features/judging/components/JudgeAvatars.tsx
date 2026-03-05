import { motion } from "framer-motion";
import { getAvatarImagePath } from "../../../shared/constants/avatar";
import { useJudgeBreathing } from "../../../shared/hooks/useJudgeBreathing";
import { useJudgeEntrance } from "../../../shared/hooks/useJudgeEntrance";
import { useJudgeSpeech } from "../../../shared/hooks/useJudgeSpeech";
import type { JudgePersona } from "../../../shared/types/domain";
import { JudgeSpeechBubble } from "./JudgeSpeechBubble";

type ViewMode = "top" | "judging" | "result";

interface JudgeAvatarsProps {
	/** TODO: 将来の画面別表示制御で利用予定。現時点では仕様により常時表示。 */
	viewMode: ViewMode;
	isJudging: boolean;
	isPostModalOpen: boolean;
}

/** 審査員設定（表示順: 中尾 -> ひろゆき -> デヴィ） */
const JUDGE_CONFIG: readonly { id: JudgePersona; name: string }[] = [
	{ id: "nakao", name: "中尾彬風審査員" },
	{ id: "hiroyuki", name: "ひろゆき風審査員" },
	{ id: "dewi", name: "デヴィ夫人風審査員" },
] as const;

/** フォールバックスピーチ（currentSpeechがnull時の表示） */
const FALLBACK_SPEECH = "...";

/**
 * 審査員アバターを横並びで表示するコンポーネント
 */
export function JudgeAvatars({
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
				const entrance = entranceVariants[judge.id];
				const breathing = breathingVariants[judge.id];
				const displaySpeech = isSpeaking
					? (currentSpeech ?? FALLBACK_SPEECH)
					: null;

				return (
					<div key={judge.id} className="relative flex flex-col items-center">
						{isSpeaking && displaySpeech && (
							<JudgeSpeechBubble
								isVisible={true}
								text={displaySpeech}
								judgeType={judge.id}
							/>
						)}

						<motion.img
							src={getAvatarImagePath(judge.id, "base")}
							alt={judge.name}
							className="w-20 md:w-32 h-auto"
							initial={entrance.initial}
							animate={
								hasEntered
									? isBreathing
										? breathing.keyframes
										: entrance.animate
									: entrance.animate
							}
							transition={
								hasEntered
									? isBreathing
										? breathing.transition
										: entrance.transition
									: entrance.transition
							}
							draggable={false}
						/>
					</div>
				);
			})}
		</div>
	);
}
