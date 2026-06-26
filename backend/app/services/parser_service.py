import re
from io import BytesIO

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


def extract_text(file_bytes: bytes, content_type: str) -> str:
    if content_type == "application/pdf":
        return _from_pdf(BytesIO(file_bytes))
    return _from_docx(BytesIO(file_bytes))


def detect_sections(text: str) -> list[str]:
    lines = {line.strip().lower() for line in text.splitlines() if line.strip()}
    found = []
    for label, keywords in _SECTIONS.items():
        for kw in keywords:
            pattern = re.compile(r'\b' + re.escape(kw) + r'\b')
            if any(pattern.search(line) for line in lines):
                found.append(label)
                break
    return found


def _from_pdf(file_obj: BytesIO) -> str:
    pages = []
    with pdfplumber.open(file_obj) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                pages.append(text.strip())
    return "\n\n".join(pages)


def _from_docx(file_obj: BytesIO) -> str:
    doc = Document(file_obj)
    return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
