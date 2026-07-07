import type {ComponentType} from 'react';
import AdvancedSlantTipsCornersEdgesAnd2sArticle, {metadata as AdvancedSlantTipsCornersEdgesAnd2sArticleMetadata} from '../../content/en/guides/advanced-slant-tips-corners-edges-and-2s.mdx';
import HowToPlaySlantBeginnerPuzzleGuideArticle, {metadata as HowToPlaySlantBeginnerPuzzleGuideArticleMetadata} from '../../content/en/guides/how-to-play-slant-beginner-puzzle-guide.mdx';
import PrintableSlantPuzzlesPaperLogicPracticeArticle, {metadata as PrintableSlantPuzzlesPaperLogicPracticeArticleMetadata} from '../../content/en/guides/printable-slant-puzzles-paper-logic-practice.mdx';
import SlantFreePuzzlesBestWayToPracticeLogicArticle, {metadata as SlantFreePuzzlesBestWayToPracticeLogicArticleMetadata} from '../../content/en/guides/slant-free-puzzles-best-way-to-practice-logic.mdx';
import SlantOnlineGuideFromFirstClickToSolveArticle, {metadata as SlantOnlineGuideFromFirstClickToSolveArticleMetadata} from '../../content/en/guides/slant-online-guide-from-first-click-to-solve.mdx';
import SlantPuzzleMistakesBeginnersShouldAvoidArticle, {metadata as SlantPuzzleMistakesBeginnersShouldAvoidArticleMetadata} from '../../content/en/guides/slant-puzzle-mistakes-beginners-should-avoid.mdx';
import SlantRulesExplainedLinesNumbersNoLoopsArticle, {metadata as SlantRulesExplainedLinesNumbersNoLoopsArticleMetadata} from '../../content/en/guides/slant-rules-explained-lines-numbers-no-loops.mdx';
import SlantTipsForStuckPlayersFindNextMovesArticle, {metadata as SlantTipsForStuckPlayersFindNextMovesArticleMetadata} from '../../content/en/guides/slant-tips-for-stuck-players-find-next-moves.mdx';
import SlantOfDayHowDailyChallengesImproveSkillArticle, {metadata as SlantOfDayHowDailyChallengesImproveSkillArticleMetadata} from '../../content/en/guides/slant-of-day-how-daily-challenges-improve-skill.mdx';
import SlantVsSudokuWhichLogicPuzzleFitsBestArticle, {metadata as SlantVsSudokuWhichLogicPuzzleFitsBestArticleMetadata} from '../../content/en/guides/slant-vs-sudoku-which-logic-puzzle-fits-best.mdx';
import WhyPlayASlantDailyGameEveryDayArticle, {metadata as WhyPlayASlantDailyGameEveryDayArticleMetadata} from '../../content/en/guides/why-play-a-slant-daily-game-every-day.mdx';

export type GuideMetadata = {
  title: string;
  description: string;
  category?: string;
  date?: string;
  lastModified?: string;
  image?: string;
};

export type GuideContent = {
  slug: string;
  metadata: GuideMetadata;
  Component: ComponentType;
};

export const guideContentBySlug: Record<string, GuideContent> = {
  'advanced-slant-tips-corners-edges-and-2s': {
    slug: 'advanced-slant-tips-corners-edges-and-2s',
    metadata: AdvancedSlantTipsCornersEdgesAnd2sArticleMetadata,
    Component: AdvancedSlantTipsCornersEdgesAnd2sArticle
  },
  'how-to-play-slant-beginner-puzzle-guide': {
    slug: 'how-to-play-slant-beginner-puzzle-guide',
    metadata: HowToPlaySlantBeginnerPuzzleGuideArticleMetadata,
    Component: HowToPlaySlantBeginnerPuzzleGuideArticle
  },
  'printable-slant-puzzles-paper-logic-practice': {
    slug: 'printable-slant-puzzles-paper-logic-practice',
    metadata: PrintableSlantPuzzlesPaperLogicPracticeArticleMetadata,
    Component: PrintableSlantPuzzlesPaperLogicPracticeArticle
  },
  'slant-free-puzzles-best-way-to-practice-logic': {
    slug: 'slant-free-puzzles-best-way-to-practice-logic',
    metadata: SlantFreePuzzlesBestWayToPracticeLogicArticleMetadata,
    Component: SlantFreePuzzlesBestWayToPracticeLogicArticle
  },
  'slant-online-guide-from-first-click-to-solve': {
    slug: 'slant-online-guide-from-first-click-to-solve',
    metadata: SlantOnlineGuideFromFirstClickToSolveArticleMetadata,
    Component: SlantOnlineGuideFromFirstClickToSolveArticle
  },
  'slant-puzzle-mistakes-beginners-should-avoid': {
    slug: 'slant-puzzle-mistakes-beginners-should-avoid',
    metadata: SlantPuzzleMistakesBeginnersShouldAvoidArticleMetadata,
    Component: SlantPuzzleMistakesBeginnersShouldAvoidArticle
  },
  'slant-rules-explained-lines-numbers-no-loops': {
    slug: 'slant-rules-explained-lines-numbers-no-loops',
    metadata: SlantRulesExplainedLinesNumbersNoLoopsArticleMetadata,
    Component: SlantRulesExplainedLinesNumbersNoLoopsArticle
  },
  'slant-tips-for-stuck-players-find-next-moves': {
    slug: 'slant-tips-for-stuck-players-find-next-moves',
    metadata: SlantTipsForStuckPlayersFindNextMovesArticleMetadata,
    Component: SlantTipsForStuckPlayersFindNextMovesArticle
  },
  'slant-of-day-how-daily-challenges-improve-skill': {
    slug: 'slant-of-day-how-daily-challenges-improve-skill',
    metadata: SlantOfDayHowDailyChallengesImproveSkillArticleMetadata,
    Component: SlantOfDayHowDailyChallengesImproveSkillArticle
  },
  'slant-vs-sudoku-which-logic-puzzle-fits-best': {
    slug: 'slant-vs-sudoku-which-logic-puzzle-fits-best',
    metadata: SlantVsSudokuWhichLogicPuzzleFitsBestArticleMetadata,
    Component: SlantVsSudokuWhichLogicPuzzleFitsBestArticle
  },
  'why-play-a-slant-daily-game-every-day': {
    slug: 'why-play-a-slant-daily-game-every-day',
    metadata: WhyPlayASlantDailyGameEveryDayArticleMetadata,
    Component: WhyPlayASlantDailyGameEveryDayArticle
  }
};

export const guideContents = Object.values(guideContentBySlug);

export function getGuideContent(slug: string) {
  return guideContentBySlug[slug] ?? null;
}
