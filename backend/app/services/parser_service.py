import re

import pdfplumber
from docx import Document

# Map of display label → keywords to look for in extracted text
_SECTIONS = {
    "Summary":        ["summary", "objective", "profile", "about"],
    "Education":      ["education", "academic background", "qualifications"],
    "Experience":     ["experience", "work experience", "employment", "work history"],
    "Skills":         ["skills", "technical skills", "core competencies", "technologies"],
    "Projects":       ["projects", "personal projects", "side projects", "portfolio"],
    "Certifications": ["certifications", "certificates", "credentials", "licenses"],
    "Awards":         ["awards", "honors", "achievements", "recognition"],
    "Publications":   ["publications", "research", "papers"],
    "Languages":      ["languages"],
    "Volunteering":   ["volunteering", "volunteer", "community service"],
}


def extract_text(filepath: str, content_type: str) -> str:
    if content_type == "application/pdf":
        return _from_pdf(filepath)
    return _from_docx(filepath)


def detect_sections(text: str) -> list[str]:
    """Return section labels whose keywords appear as standalone lines in the text."""
    lines = {line.strip().lower() for line in text.splitlines() if line.strip()}
    found = []
    for label, keywords in _SECTIONS.items():
        for kw in keywords:
            pattern = re.compile(r'\b' + re.escape(kw) + r'\b')
            if any(pattern.search(line) for line in lines):
                found.append(label)
                break
    return found


def _from_pdf(filepath: str) -> str:
    pages = []
    with pdfplumber.open(filepath) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
    return "\n\n".join(pages)


def _from_docx(filepath: str) -> str:
    doc = Document(filepath)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
