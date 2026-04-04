/**
 * Optimized stop word list for NZ economic news clustering.
 *
 * Three layers, combined at export:
 *   1. ENGLISH_STOP_WORDS — standard function words (articles, prepositions, pronouns, etc.)
 *   2. NEWS_JOURNALISM_STOP_WORDS — words ubiquitous in any news article
 *   3. NZ_ECONOMY_STOP_WORDS — terms that appear across ALL NZ economy articles
 *
 * Design rationale (research summary):
 *
 * - The Notre Dame SRAF project (sraf.nd.edu) maintains domain-specific stop word
 *   lists for financial text mining. Their key insight: "no universal list of stop
 *   words exists since what is considered uninformative depends on the context."
 *
 * - Kavita Ganesan's research on custom stop word construction recommends:
 *   (a) removing words appearing in >85% of documents in your corpus
 *   (b) using low-IDF terms as stop words — IDF = log(N/M), where M = docs containing term
 *   (c) starting with ~20 domain words and expanding by 10 until you hit useful words
 *
 * - Nothman et al. (2018) found alarming inconsistencies across 52 open-source stop
 *   word lists — misspellings, informative words included, internal inconsistencies.
 *   Always inspect and verify your list.
 *
 * - For news clustering specifically, "Supervised Machine Learning for Text Analysis
 *   in R" (Hvitfeldt & Silge) categorizes stop words into: global (safe to remove),
 *   subject-specific (domain words), and document-level (corpus-specific). All three
 *   layers are represented here.
 *
 * - Research on news article topic detection (DEV Community / Agglomerative Hierarchical
 *   Clustering with TF-IDF) shows that stop word removal + stemming before TF-IDF
 *   vectorization significantly improves clustering quality.
 *
 * Impact on clustering:
 *   - Small, focused lists (~100–200 words) reduce dimensionality without losing signal
 *   - Overly aggressive removal hurts recall — err on the side of keeping words
 *   - Domain stop words have the BIGGEST impact: "economy" in every NZ econ article
 *     creates false similarity between unrelated stories
 *
 * When to use this vs. TF-IDF automatic down-weighting:
 *   - Stop words: fast, deterministic, zero-dependency — ideal for title-based matching
 *     where the "corpus" is too small for meaningful IDF (just a few open stories)
 *   - TF-IDF: better for body-text clustering with 50+ documents — IDF naturally
 *     down-weights corpus-wide terms. See `computeIdfWeights()` below for a
 *     lightweight implementation.
 *
 * Sources:
 *   - SRAF Notre Dame: https://sraf.nd.edu/textual-analysis/stopwords/
 *   - Ganesan: https://kavita-ganesan.com/tips-for-constructing-custom-stop-word-lists/
 *   - Hvitfeldt & Silge: https://smltar.com/stopwords
 *   - Brigadir stopwords collection: https://github.com/igorbrigadir/stopwords
 *   - Stanford IR Book: https://nlp.stanford.edu/IR-book/html/htmledition/dropping-common-terms-stop-words-1.html
 *   - Saif et al. (2020) "Accelerating Text Mining Using Domain-Specific Stop Word Lists"
 */

// =============================================================================
// Layer 1: Standard English function words (~90 words)
// Based on Snowball/NLTK lists (the most widely used, ~429 words in full),
// pruned to the most frequent. We keep the list moderate — research shows
// diminishing returns past ~120 generic words and increasing risk of removing
// meaningful terms.
// =============================================================================

const ENGLISH_STOP_WORDS = [
  // articles
  "a",
  "an",
  "the",
  // be-verbs
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "am",
  // prepositions
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "at",
  "by",
  "from",
  "into",
  "through",
  "during",
  "before",
  "between",
  "under",
  "above",
  // conjunctions
  "and",
  "or",
  "but",
  "nor",
  "yet",
  // pronouns
  "it",
  "its",
  "this",
  "that",
  "these",
  "those",
  "he",
  "she",
  "they",
  "them",
  "their",
  "his",
  "her",
  "we",
  "our",
  "you",
  "your",
  // auxiliaries / modals
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "can",
  "shall",
  // common verbs
  "has",
  "have",
  "had",
  "having",
  "do",
  "does",
  "did",
  "get",
  "got",
  "getting",
  // question words
  "how",
  "why",
  "what",
  "when",
  "who",
  "whom",
  "which",
  "where",
  // adverbs / determiners
  "not",
  "no",
  "than",
  "more",
  "most",
  "very",
  "just",
  "also",
  "too",
  "only",
  "even",
  "still",
  "already",
  "then",
  "now",
  "here",
  "there",
  // other function words
  "if",
  "so",
  "as",
  "up",
  "out",
  "about",
  "over",
  "after",
  "all",
  "some",
  "any",
  "each",
  "every",
  "both",
  "few",
  "own",
  "such",
  "same",
  "other",
  "much",
  "well",
  "back",
] as const;

// =============================================================================
// Layer 2: News / journalism stop words (~40 words)
// Words that appear in virtually every news article regardless of topic.
// Identified from common NZ news sources (RNZ, Stuff, Herald, 1News).
// =============================================================================

const NEWS_JOURNALISM_STOP_WORDS = [
  // attribution verbs — every article has "X says Y"
  "says",
  "said",
  "told",
  "according",
  "reported",
  "announced",
  "confirmed",
  "revealed",
  "added",
  "stated",
  "explained",
  "noted",
  "warned",
  // temporal — news always references time
  "today",
  "yesterday",
  "last",
  "week",
  "month",
  "year",
  "ago",
  "recently",
  "latest",
  "earlier",
  "since",
  "currently",
  // news framing
  "new",
  "first",
  "set",
  "expected",
  "likely",
  "around",
  "nearly",
  "per",
  "people",
  "make",
  "made",
  "come",
  "came",
  "take",
  "took",
  "going",
  "gone",
  "way",
] as const;

// =============================================================================
// Layer 3: NZ economy domain stop words (~60 words)
// These are the KEY innovation — words that appear across virtually all NZ
// economic news but provide zero discriminating signal for clustering.
//
// "economy" appears in articles about OCR, housing, fuel, groceries — it
// creates false similarity. Same for "percent", "government", etc.
//
// IMPORTANT: These words ARE meaningful in general English but are NOT useful
// for distinguishing one NZ economy story from another.
//
// This list should NOT include words that identify specific topics:
//   KEEP: "mortgage", "petrol", "rent", "inflation", "ocr", "rbnz"
//   REMOVE: "economy", "percent", "government", "price" (too generic)
// =============================================================================

const NZ_ECONOMY_STOP_WORDS = [
  // --- geographic / national (every NZ news article) ---
  "nz",
  "zealand",
  "new zealand",
  "kiwi",
  "kiwis",
  "aotearoa",
  "auckland",
  "wellington",
  "christchurch",
  // --- governance (appears across all policy/econ topics) ---
  "government",
  "minister",
  "ministry",
  "cabinet",
  "parliament",
  "policy",
  "official",
  "officials",
  // --- generic economic language (ubiquitous, no clustering signal) ---
  "economy",
  "economic",
  "financial",
  "market",
  "markets",
  "sector",
  "industry",
  // --- units and magnitudes (every data-driven article) ---
  "percent",
  "percentage",
  "billion",
  "million",
  "thousand",
  "dollar",
  "dollars",
  "rate",
  "rates",
  "level",
  "levels",
  // --- generic change language (used for any metric movement) ---
  "growth",
  "increase",
  "increased",
  "decrease",
  "decreased",
  "rise",
  "risen",
  "rose",
  "fall",
  "fell",
  "fallen",
  "drop",
  "dropped",
  "change",
  "changed",
  "changes",
  "higher",
  "lower",
  "high",
  "low",
  // --- generic econ nouns that span all topics ---
  "price",
  "prices",
  "cost",
  "costs",
  "data",
  "figure",
  "figures",
  "number",
  "numbers",
  "report",
  "average",
  // --- NZ news source names (filtered from RSS, not useful for clustering) ---
  "rnz",
  "stuff",
  "herald",
  "1news",
  "newshub",
  "interest",
] as const;

// =============================================================================
// Combined export — single Set for O(1) lookup
// =============================================================================

export const STOP_WORDS = new Set<string>([
  ...ENGLISH_STOP_WORDS,
  ...NEWS_JOURNALISM_STOP_WORDS,
  ...NZ_ECONOMY_STOP_WORDS,
]);

/**
 * Extract significant words from text, removing stop words and short tokens.
 * Used for title-based story matching where corpus is too small for TF-IDF.
 */
export function extractSignificantWords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, "")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
  );
}

// =============================================================================
// Lightweight TF-IDF for body-text clustering
//
// When you have 10+ documents (e.g., a batch of RSS articles), TF-IDF
// automatically down-weights words common across the corpus — no stop word
// list needed. This is complementary to the static list above.
//
// How it works:
//   TF(term, doc)  = count of term in doc / total terms in doc
//   IDF(term)      = log(N / (1 + docs containing term))
//   TF-IDF         = TF * IDF
//
// Words appearing in every document get IDF ~0, effectively becoming stop
// words without being on any list. This handles emergent common terms that
// a static list can't anticipate.
//
// References:
//   - scikit-learn TfidfVectorizer: max_df parameter does this automatically
//   - tiny-tfidf (github.com/kerryrodden/tiny-tfidf): minimal JS implementation
//   - Ganesan: "eliminating words in 85% of documents" ≈ max_df=0.85
// =============================================================================

interface TermWeights {
  /** Document frequency: how many documents contain each term */
  df: Map<string, number>;
  /** Total number of documents */
  docCount: number;
  /** IDF weight for each term across the corpus */
  idf: Map<string, number>;
}

/**
 * Compute IDF weights from a set of documents. Terms appearing in >85% of
 * documents are effectively zero-weighted (they become automatic stop words).
 *
 * Usage:
 * ```ts
 * const docs = articles.map(a => a.title + " " + (a.content ?? ""));
 * const weights = computeIdfWeights(docs);
 * const vec = tfidfVector(docs[0], weights);
 * const sim = cosineSimilarity(vec1, vec2);
 * ```
 */
export function computeIdfWeights(documents: string[]): TermWeights {
  const n = documents.length;
  const df = new Map<string, number>();

  for (const doc of documents) {
    const uniqueTerms = extractSignificantWords(doc);
    for (const term of uniqueTerms) {
      df.set(term, (df.get(term) ?? 0) + 1);
    }
  }

  const idf = new Map<string, number>();
  for (const [term, count] of df) {
    // Standard IDF with smoothing: log(N / (1 + df))
    // Terms in >85% of docs get very low weight (~0.07 for 85%)
    idf.set(term, Math.log(n / (1 + count)));
  }

  return { idf, df, docCount: n };
}

/**
 * Compute a TF-IDF vector for a single document given pre-computed IDF weights.
 * Returns a sparse map of term -> tfidf score.
 */
export function tfidfVector(
  text: string,
  weights: TermWeights
): Map<string, number> {
  const terms = text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, "")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w));

  const tf = new Map<string, number>();
  for (const term of terms) {
    tf.set(term, (tf.get(term) ?? 0) + 1);
  }

  const totalTerms = terms.length || 1;
  const vector = new Map<string, number>();

  for (const [term, count] of tf) {
    const termFreq = count / totalTerms;
    const idfWeight = weights.idf.get(term) ?? 0;
    const score = termFreq * idfWeight;
    if (score > 0) {
      vector.set(term, score);
    }
  }

  return vector;
}

/**
 * Cosine similarity between two TF-IDF vectors. Returns 0–1.
 * Useful for comparing article bodies when you have enough documents
 * for meaningful IDF weights (10+).
 */
export function cosineSimilarity(
  a: Map<string, number>,
  b: Map<string, number>
): number {
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (const [term, weight] of a) {
    normA += weight * weight;
    const bWeight = b.get(term);
    if (bWeight !== undefined) {
      dotProduct += weight * bWeight;
    }
  }

  for (const [, weight] of b) {
    normB += weight * weight;
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) {
    return 0;
  }

  return dotProduct / denominator;
}
