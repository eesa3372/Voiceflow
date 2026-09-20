//! Custom Vocabulary & Technical Dictionary Engine
//!
//! Handles scientific, chemical, biomedical, and engineering jargon.
//! Preserves case and formatting for abbreviations such as:
//! LiHMDS, DIBAL-H, Suzuki coupling, HPLC, NMR, RDKit, ChemDraw.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VocabularyTerm {
    pub id: String,
    pub term: String,
    pub alternatives: Vec<String>,
    pub category: String,
}

pub struct VocabularyEngine {
    terms: Vec<VocabularyTerm>,
}

impl VocabularyEngine {
    pub fn new() -> Self {
        Self {
            terms: vec![
                VocabularyTerm {
                    id: "vocab-1".to_string(),
                    term: "LiHMDS".to_string(),
                    alternatives: vec![
                        "L-I-H-M-D-S".to_string(),
                        "lihmds".to_string(),
                        "Li H M D S".to_string(),
                    ],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-2".to_string(),
                    term: "DIBAL-H".to_string(),
                    alternatives: vec![
                        "dibal h".to_string(),
                        "die ball h".to_string(),
                        "DIBAL".to_string(),
                    ],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-3".to_string(),
                    term: "Suzuki coupling".to_string(),
                    alternatives: vec![
                        "suzuki cross coupling".to_string(),
                        "suzuki reaction".to_string(),
                    ],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-4".to_string(),
                    term: "Buchwald-Hartwig".to_string(),
                    alternatives: vec!["buchwald hartwig amination".to_string()],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-5".to_string(),
                    term: "LC-MS".to_string(),
                    alternatives: vec!["L C M S".to_string(), "lcms".to_string()],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-6".to_string(),
                    term: "HPLC".to_string(),
                    alternatives: vec!["H P L C".to_string(), "hplc".to_string()],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-7".to_string(),
                    term: "NMR".to_string(),
                    alternatives: vec!["N M R".to_string()],
                    category: "chemistry".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-8".to_string(),
                    term: "RDKit".to_string(),
                    alternatives: vec!["rd kit".to_string(), "R D kit".to_string()],
                    category: "software".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-9".to_string(),
                    term: "ChemDraw".to_string(),
                    alternatives: vec!["chem draw".to_string()],
                    category: "software".to_string(),
                },
                VocabularyTerm {
                    id: "vocab-10".to_string(),
                    term: "AutoDock Vina".to_string(),
                    alternatives: vec!["autodock vina".to_string(), "auto dock vina".to_string()],
                    category: "software".to_string(),
                },
            ],
        }
    }

    pub fn get_terms(&self) -> Vec<VocabularyTerm> {
        self.terms.clone()
    }

    pub fn add_term(&mut self, term: VocabularyTerm) {
        self.terms.push(term);
    }

    pub fn delete_term(&mut self, id: &str) {
        self.terms.retain(|t| t.id != id);
    }

    /// Replaces phonetic approximations and alternate casing with official technical term
    pub fn apply_vocabulary(&self, input: &str) -> String {
        let mut result = input.to_string();

        for item in &self.terms {
            // Replace alternatives with the canonical term
            for alt in &item.alternatives {
                let pattern = format!(r"(?i)\b{}\b", regex::escape(alt));
                if let Ok(re) = regex::Regex::new(&pattern) {
                    result = re.replace_all(&result, item.term.as_str()).to_string();
                }
            }

            // Also normalize case of the term itself
            let term_pattern = format!(r"(?i)\b{}\b", regex::escape(&item.term));
            if let Ok(re) = regex::Regex::new(&term_pattern) {
                result = re.replace_all(&result, item.term.as_str()).to_string();
            }
        }

        result
    }
}
