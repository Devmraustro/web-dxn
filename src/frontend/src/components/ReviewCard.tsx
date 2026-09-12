import React from "react";
import { Image, Row, Col } from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";

interface ReviewCardProps {
  review: {
    _id: string;
    customerName: string;
    rating: number;
    title?: string;
    content?: string;
    images?: string[];
    createdAt: string;
  };
}

const ReviewCard: React.FC<ReviewCardProps> = ({ review }) => {
  const { language } = useLanguage();

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const formattedDate = new Date(review.createdAt).toLocaleDateString(
    language === "ar" ? "ar-DZ" : "fr-DZ",
    { year: "numeric", month: "long", day: "numeric" }
  );

  return (
    <div className="dxn-review-card mb-3" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
        <div className="flex-grow-1">
          <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
            <strong className="me-1" style={{ color: "#0b3d1f" }}>
              {review.customerName || t("(مجهول)", "(Anonyme)")}
            </strong>
            <div aria-label={`${review.rating} out of 5 stars`}>
              {[1, 2, 3, 4, 5].map((star) => (
                <span
                  key={star}
                  style={{
                    color: star <= review.rating ? "#d4a017" : "#e3e7e3",
                    fontSize: "1rem",
                  }}
                  aria-hidden="true"
                >
                  ★
                </span>
              ))}
            </div>
            <small className="text-muted">{formattedDate}</small>
          </div>

          {review.title && (
            <div className="fw-semibold text-secondary mb-1">{review.title}</div>
          )}

          {review.content && (
            <p className="mb-2" style={{ fontSize: "0.95rem", color: "#4a5a50" }}>
              {review.content}
            </p>
          )}

          {review.images && review.images.length > 0 && (
            <Row className="g-2 mt-1">
              {review.images.map((url, i) => (
                <Col xs="auto" key={i}>
                  <Image
                    src={url}
                    thumbnail
                    style={{
                      width: 80,
                      height: 80,
                      objectFit: "cover",
                      cursor: "pointer",
                      borderColor: "#e8ecea",
                    }}
                    alt={`${t("لقطة شاشة", "Screenshot")} ${i + 1}`}
                    title={t("انقر لتكبير", "Cliquez pour agrandir")}
                    onClick={() => window.open(url, "_blank")}
                  />
                </Col>
              ))}
            </Row>
          )}
        </div>
      </div>
    </div>
  );
};

export default ReviewCard;