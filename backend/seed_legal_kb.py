"""
Seed a small STARTER set of verified Ethiopian legal provisions into the legal
library so the grounded-answer feature works out of the box.

This is a starter set only — the admin should verify each entry against the
official source and expand the library from the "Legal Library" admin tab.
Idempotent: skips a provision if the same (law_code, article) already exists.
"""
from dotenv import load_dotenv
load_dotenv()

from database import SessionLocal
from models import LegalProvision
import legal_service

STARTER = [
    {
        "law_code": "FDRE Constitution (1995)",
        "article": "Article 25",
        "title": "Right to Equality",
        "source_url": "https://www.constituteproject.org/constitution/Ethiopia_1994",
        "content": (
            "All persons are equal before the law and are entitled without any discrimination to the "
            "equal protection of the law. In this respect, the law shall guarantee to all persons equal "
            "and effective protection without discrimination on grounds of race, nation, nationality, or "
            "other social origin, colour, sex, language, religion, political or other opinion, property, "
            "birth or other status."
        ),
    },
    {
        "law_code": "FDRE Constitution (1995)",
        "article": "Article 20",
        "title": "Rights of Persons Accused",
        "source_url": "https://www.constituteproject.org/constitution/Ethiopia_1994",
        "content": (
            "Accused persons have the right to be informed with sufficient particulars of the charge "
            "brought against them and to be given the charge in writing. They have the right to be "
            "presumed innocent until proved guilty according to law and not to be compelled to testify "
            "against themselves. Accused persons have the right to a public trial by an ordinary court "
            "of law within a reasonable time after having been charged, and to full access to any "
            "evidence presented against them."
        ),
    },
    {
        "law_code": "Labour Proclamation No. 1156/2019",
        "article": "Article 11",
        "title": "Probation Period",
        "source_url": "https://justice.gov.et/en/law/labour-proclamation/",
        "content": (
            "A person may be employed for a probation period to test his suitability for the post to "
            "which he is expected to be assigned. Where the parties agree to a probation period, it "
            "shall be made in writing and shall not exceed sixty (60) working days from the date of "
            "commencement of the work. During the probation period either party may terminate the "
            "contract of employment without notice and without being obliged to pay compensation."
        ),
    },
    {
        "law_code": "Labour Proclamation No. 1156/2019",
        "article": "Article 35",
        "title": "Period of Notice for Termination",
        "source_url": "https://justice.gov.et/en/law/labour-proclamation/",
        "content": (
            "Unless otherwise provided in this Proclamation, the period of notice for the termination of "
            "a contract of employment of indefinite duration shall be: (a) one (1) month for a worker "
            "who has completed probation and has a period of service not exceeding one year; (b) two (2) "
            "months for a worker whose period of service is more than one year up to nine years; and "
            "(c) three (3) months for a worker whose period of service is more than nine years. Notice "
            "of termination shall be given in writing."
        ),
    },
    {
        "law_code": "Labour Proclamation No. 1156/2019",
        "article": "Article 77",
        "title": "Annual Leave",
        "source_url": "https://justice.gov.et/en/law/labour-proclamation/",
        "content": (
            "A worker shall be entitled to an uninterrupted annual leave with pay of: (a) sixteen (16) "
            "working days for the first year of service; and (b) sixteen (16) working days plus one (1) "
            "working day for every additional two years of service. Annual leave for a worker who has "
            "served for less than one year shall be calculated in proportion to the length of service."
        ),
    },
    {
        "law_code": "Revised Family Code (Proclamation No. 213/2000)",
        "article": "Article 7",
        "title": "Age of Marriage",
        "source_url": "https://www.refworld.org/legal/legislation/natlegbod/2000/en/72300",
        "content": (
            "Neither a man nor a woman who has not attained the full age of eighteen (18) years shall "
            "conclude marriage. Notwithstanding this, the Minister of Justice may, on the application of "
            "the future spouses, or the parents or guardian of one of them, for serious cause, grant a "
            "dispensation of not more than two years."
        ),
    },
]


def seed():
    db = SessionLocal()
    added = 0
    try:
        for item in STARTER:
            exists = db.query(LegalProvision).filter(
                LegalProvision.law_code == item["law_code"],
                LegalProvision.article == item["article"],
            ).first()
            if exists:
                print(f"skip (exists): {item['law_code']} {item['article']}")
                continue
            p = LegalProvision(
                law_code=item["law_code"],
                article=item["article"],
                title=item["title"],
                content=item["content"],
                language="en",
                source_url=item["source_url"],
                is_active=True,
            )
            p.embedding = legal_service.embed_text(
                f"{p.law_code} {p.article} {p.title}\n{p.content}"
            )
            db.add(p)
            db.commit()
            added += 1
            print(f"added: {item['law_code']} {item['article']}")
    finally:
        db.close()
    print(f"\nSeed complete. Added {added} provision(s).")


if __name__ == "__main__":
    seed()
