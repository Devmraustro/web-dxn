import React, { useEffect, useState, useRef } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Badge,
  Alert,
  Modal,
  Image,
  Spinner,
} from "react-bootstrap";

interface Review {
  _id: string;
  productId: { _id: string; sku?: string; translations?: { ar?: { name: string }; fr?: { name: string } } };
  customerName: string;
  rating: number;
  title: string;
  content: string;
  images: string[];
  isPublished: boolean;
  createdAt: string;
}

interface Product {
  _id: string;
  sku?: string;
  language?: string;
  title?: string;
  translations?:
    | Array<{ language?: string; title?: string }>
    | { ar?: { name?: string; title?: string }; fr?: { name?: string; title?: string } };
}

const AdminReviewPage = () => {
  const { language } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    productId: "",
    customerName: "",
    rating: "5",
    title: "",
    content: "",
    images: [] as string[],
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = (ar: string, fr: string) => (language === "ar" ? ar : fr);

  const loadReviews = async () => {
    try {
      const response = await axios.get("/api/reviews/all");
      setReviews(response.data.data);
    } catch (err) {
      console.error("Error loading reviews:", err);
    }
  };

  const loadProducts = async () => {
    try {
      const response = await axios.get("/api/products");
      setProducts(response.data.data || []);
    } catch (err) {
      console.error("Error loading products:", err);
    }
  };

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await Promise.all([loadReviews(), loadProducts()]);
      setLoading(false);
    };
    init();
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    setFormError(null);
    const newUrls: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const fd = new FormData();
        fd.append("image", file);
        // No manual Content-Type: axios must set the multipart boundary itself.
        const response = await axios.post("/api/upload/image", fd);
        newUrls.push(response.data.data.url);
      }
      setForm((prev) => ({ ...prev, images: [...prev.images, ...newUrls] }));
      setSuccess(t("تم رفع الصور بنجاح", "Images uploaded successfully"));
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
          t("فشل رفع الصور", "Image upload failed")
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeImage = async (url: string) => {
    try {
      await axios.delete("/api/upload/image", { data: { url } });
    } catch {
    }
    setForm((prev) => ({ ...prev, images: prev.images.filter((u) => u !== url) }));
  };

  const resetForm = () => {
    setForm({ productId: "", customerName: "", rating: "5", title: "", content: "", images: [] });
    setEditingId(null);
    setFormError(null);
    setShowModal(false);
  };

  const openCreate = () => {
    resetForm();
    setShowModal(true);
  };

  const openEdit = (review: Review) => {
    setForm({
      productId: typeof review.productId === "object" ? review.productId._id : review.productId,
      customerName: review.customerName || "",
      rating: String(review.rating),
      title: review.title || "",
      content: review.content || "",
      images: review.images || [],
    });
    setEditingId(review._id);
    setFormError(null);
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.productId) {
      setFormError(t("الرجاء اختيار المنتج", "Please select a product"));
      return;
    }
    if (!form.customerName.trim()) {
      setFormError(t("الرجاء إدخال اسم العميل", "Please enter customer name"));
      return;
    }

    try {
      const payload = {
        productId: form.productId,
        customerName: form.customerName.trim(),
        rating: parseInt(form.rating),
        title: form.title.trim(),
        content: form.content.trim(),
        images: form.images,
      };

      if (editingId) {
        await axios.put(`/api/reviews/${editingId}`, payload);
        setSuccess(t("تم تحديث التقييم بنجاح", "Review updated successfully"));
      } else {
        await axios.post("/api/reviews", payload);
        setSuccess(t("تم إنشاء التقييم بنجاح", "Review created successfully"));
      }

      await loadReviews();
      resetForm();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message ||
          t("فشل حفظ التقييم", "Failed to save review")
      );
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t("هل أنت متأكد من حذف هذا التقييم؟", "Delete this review?"))) return;
    try {
      await axios.delete(`/api/reviews/${id}`);
      await loadReviews();
      setSuccess(t("تم حذف التقييم", "Review deleted"));
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError(t("فشل حذف التقييم", "Failed to delete review"));
    }
  };

  const productDisplayName = (p: any, language: string): string => {
    if (!p) return "";
    const want = language === "ar" ? "ar" : "fr";
    // New API shape: translations as array of { language, title }
    if (Array.isArray(p.translations)) {
      const found = p.translations.find((tr: any) => tr.language === want);
      if (found?.title) return found.title;
      const anyLang = p.translations.find((tr: any) => tr.title);
      if (anyLang?.title) return anyLang.title;
    } else if (p.translations && typeof p.translations === "object") {
      if (p.translations[want]?.name) return p.translations[want].name;
      if (p.translations[want]?.title) return p.translations[want].title;
      if (p.translations.ar?.name) return p.translations.ar.name;
      if (p.translations.fr?.name) return p.translations.fr.name;
    }
    // Enriched top-level merge (API called with ?language=)
    if (p.language === want && p.title) return p.title;
    return p.sku || String(p._id || "").slice(0, 8);
  };

  const getProductName = (review: Review) => {
    const raw: any = review.productId;
    const id = raw && typeof raw === "object" ? String(raw._id || "") : String(raw || "");
    // Prefer the current catalog label (fall back to the raw stored value).
    const match = products.find((p) => p._id === id);
    if (match) return productDisplayName(match, language);
    if (raw && typeof raw === "object") return productDisplayName(raw, language);
    return id;
  };

  if (loading) {
    return (
      <div className="text-center mt-5">
        <Spinner animation="border" />
        <p className="mt-2">{t("جاري التحميل...", "Loading...")}</p>
      </div>
    );
  }

  return (
    <>
      <Container className="mt-4">
        <div className="d-flex justify-content-between align-items-center mb-4">
          <h1>{t("إدارة التقييمات", "Gestion des avis")}</h1>
          <Button variant="primary" className="dxn-btn dxn-btn-primary" onClick={openCreate}>
            {t("إضافة تقييم", "Ajouter un avis")}
          </Button>
        </div>

        {success && <Alert variant="success">{success}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        {reviews.length === 0 ? (
          <Alert variant="info">{t("لا توجد تقييمات بعد", "Aucun avis pour le moment")}</Alert>
        ) : (
          <Row>
            {reviews.map((review) => (
              <Col key={review._id} xs={12} className="mb-3">
                <Card>
                  <Card.Body>
                    <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                      <div className="flex-grow-1">
                        <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                          <strong>{review.customerName || t("(بدون اسم)", "(sans nom)")}</strong>
                          <div>
                            {[1, 2, 3, 4, 5].map((star) => (
                              <span
                                key={star}
                                style={{
                                  color: star <= review.rating ? "#ffc107" : "#ccc",
                                  fontSize: "1.1rem",
                                }}
                              >
                                ★
                              </span>
                            ))}
                          </div>
                          <Badge bg={review.isPublished ? "success" : "secondary"}>
                            {review.isPublished
                              ? t("منشور", "Publié")
                              : t("غير منشور", "Brouillon")}
                          </Badge>
                          <small className="text-muted">
                            — {getProductName(review)}
                          </small>
                        </div>
                        {review.title && (
                          <strong className="d-block mb-1">{review.title}</strong>
                        )}
                        {review.content && (
                          <p className="mb-2 text-muted">{review.content}</p>
                        )}
                        {review.images && review.images.length > 0 && (
                          <div className="d-flex gap-2 flex-wrap mt-2">
                            {review.images.map((url, i) => (
                              <Image
                                key={i}
                                src={url}
                                thumbnail
                                style={{ width: 80, height: 80, objectFit: "cover" }}
                                alt={t("لقطة شاشة", "Screenshot") + ` ${i + 1}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="d-flex gap-2">
                        <Button
                          variant="outline-primary"
                          size="sm"
                          onClick={() => openEdit(review)}
                        >
                          {t("تعديل", "Modifier")}
                        </Button>
                        <Button
                          variant="outline-danger"
                          size="sm"
                          onClick={() => handleDelete(review._id)}
                        >
                          {t("حذف", "Supprimer")}
                        </Button>
                      </div>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            ))}
          </Row>
        )}
      </Container>

      <Modal
        show={showModal}
        onHide={resetForm}
        size="lg"
        dir={language === "ar" ? "rtl" : "ltr"}
      >
        <Modal.Header closeButton>
          <Modal.Title>
            {editingId
              ? t("تعديل التقييم", "Modifier l'avis")
              : t("إضافة تقييم جديد", "Nouvel avis")}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleSubmit}>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <Form.Group className="mb-3">
              <Form.Label>
                {t("المنتج", "Produit")} *
              </Form.Label>
              <Form.Select
                value={form.productId}
                onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
                required
                disabled={!!editingId}
              >
                <option value="">— {t("اختر المنتج", "Sélectionner un produit")} —</option>
                {products.map((p) => (
                  <option key={p._id} value={p._id}>
                    {productDisplayName(p, language)}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t("اسم العميل", "Nom du client")} *</Form.Label>
                  <Form.Control
                    type="text"
                    value={form.customerName}
                    onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))}
                    placeholder={t("مثال: أحمد", "ex: Ahmed")}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>{t("التقييم", "Note")}</Form.Label>
                  <Form.Select
                    value={form.rating}
                    onChange={(e) => setForm((f) => ({ ...f, rating: e.target.value }))}
                  >
                    {[5, 4, 3, 2, 1].map((r) => (
                      <option key={r} value={r}>
                        {"★".repeat(r)}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label>{t("عنوان التقييم", "Titre de l'avis")}</Form.Label>
              <Form.Control
                type="text"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder={t("ملخص سريع", "Résumé rapide")}
                maxLength={200}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>{t("محتوى التقييم", "Contenu de l'avis")}</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                placeholder={t("تفاصيل تقييم العميل", "Détails de l'avis du client")}
                maxLength={2000}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>
                {t("صور التقييم (لقطات شاشة)", "Images (captures d'écran)")}
              </Form.Label>
              <Form.Control
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleFileSelect}
                disabled={uploading}
              />
              <Form.Text className="text-muted">
                {t(
                  "JPEG, PNG, GIF, WebP — حتى 5 ميغابايت لكل صورة",
                  "JPEG, PNG, GIF, WebP — jusqu'à 5 Mo par image"
                )}
              </Form.Text>
              {uploading && (
                <div className="mt-2">
                  <Spinner animation="border" size="sm" />{" "}
                  {t("جاري الرفع...", "Téléchargement...")}
                </div>
              )}
            </Form.Group>

            {form.images.length > 0 && (
              <div className="d-flex gap-2 flex-wrap mb-3">
                {form.images.map((url, i) => (
                  <div key={i} className="position-relative">
                    <Image
                      src={url}
                      thumbnail
                      style={{ width: 100, height: 100, objectFit: "cover" }}
                      alt={`Preview ${i + 1}`}
                    />
                    <Button
                      variant="danger"
                      size="sm"
                      className="position-absolute top-0 end-0"
                      style={{ lineHeight: 1, padding: "2px 5px", fontSize: "0.7rem" }}
                      onClick={() => removeImage(url)}
                      aria-label={t("حذف الصورة", "Supprimer l'image")}
                    >
                      ✕
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={resetForm}>
              {t("إلغاء", "Annuler")}
            </Button>
            <Button variant="primary" type="submit" className="dxn-btn dxn-btn-primary" disabled={uploading}>
              {editingId
                ? t("حفظ التعديلات", "Enregistrer")
                : t("إنشاء التقييم", "Créer l'avis")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default AdminReviewPage;
