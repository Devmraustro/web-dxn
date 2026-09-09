import React from "react";
import { Card, Image, Row, Col } from "react-bootstrap";
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
    <Card className="mb-3" style={{ direction: language === "ar" ? "rtl" : "ltr" }}>
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
          <div className="flex-grow-1">
            <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
              <strong className="me-1">
                {review.customerName || t("(مجهول)", "(Anonyme)")}
              </strong>
              <div aria-label={`${review.rating} out of 5 stars`}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <span
                    key={star}
                    style={{
                      color: star <= review.rating ? "#ffc107" : "#ccc",
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
              <Card.Subtitle className="mb-1 text-secondary fw-normal">
                {review.title}
              </Card.Subtitle>
            )}

            {review.content && (
              <p className="mb-2" style={{ fontSize: "0.95rem" }}>
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
      </Card.Body>
    </Card>
  );
};

export default ReviewCard;
