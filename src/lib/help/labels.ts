import type { Dictionary } from "@/i18n";
import type { FeedbackLabels } from "@/components/help/ArticleFeedback";
import type { HelpSearchLabels } from "@/components/help/HelpSearch";

/**
 * Label bundles handed to the help center's client components. Client
 * components receive only the strings they render rather than the whole
 * dictionary, and building the bundles in one place keeps the pages short.
 */

export function helpSearchLabels(dict: Dictionary): HelpSearchLabels {
  return {
    label: dict.help.searchLabel,
    placeholder: dict.help.searchPlaceholder,
    button: dict.help.searchButton,
    searching: dict.help.searching,
    minLength: dict.help.searchMinLength,
    noMatches: dict.help.searchNoMatches,
    viewAll: dict.help.searchViewAll,
    optionsLabel: dict.help.searchOptionsLabel,
    inCollection: dict.help.searchIn,
  };
}

export function helpFeedbackLabels(dict: Dictionary): FeedbackLabels {
  return {
    title: dict.help.feedbackTitle,
    yes: dict.help.feedbackYes,
    no: dict.help.feedbackNo,
    commentLabel: dict.help.feedbackCommentLabel,
    commentPlaceholder: dict.help.feedbackCommentPlaceholder,
    send: dict.help.feedbackSend,
    skip: dict.help.feedbackSkip,
    sending: dict.help.feedbackSending,
    thanks: dict.help.feedbackThanks,
    failed: dict.help.feedbackFailed,
    rateLimited: dict.help.feedbackRateLimited,
  };
}
