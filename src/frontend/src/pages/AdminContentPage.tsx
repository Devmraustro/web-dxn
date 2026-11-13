import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Container,
  Row,
  Col,
  Table,
  Button,
  Form,
  Alert,
  Modal,
  Spinner,
  Badge,
} from "react-bootstrap";
import { useLanguage } from "../context/LanguageContext";
import { invalidatePublicContentCache } from "../hooks/usePublicContent";

const AdminContentPage: React.FC = () => {
  const { language, dir } = useLanguage();
  const isAr = language === "ar";
  const t = useCallback((ar: string, fr: string) => (isAr ? ar : fr), [isAr]);

  const [tab, setTab] = useState<"articles" | "faqs" | "blocks">("articles");
  const [articles, setArticles] = useState<any[]>([]);
  const [faqs, setFaqs] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [showFaqModal, setShowFaqModal] = useState(false);
  const [faqForm, setFaqForm] = useState({
    slug: "",
    category: "company",
    questionAr: "",
    questionFr: "",
    answerAr: "",
    answerFr: "",
  });

  const [showArticleModal, setShowArticleModal] = useState(false);
  const [articleForm, setArticleForm] = useState({
    slug: "",
    category: "supplements",
    titleAr: "",
    titleFr: "",
    summaryAr: "",
    summaryFr: "",
    scientificAr: "",
    scientificFr: "",
  });

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get("/api/admin/content");
      const data = res.data?.data || {};
      setArticles(Array.isArray(data.articles) ? data.articles : []);
      setFaqs(Array.isArray(data.faqs) ? data.faqs : []);
      setBlocks(data.blocks && typeof data.blocks === "object" ? data.blocks : {});
      setError(null);
    } catch {
      setError(t("فشل تحميل المحتوى", "Échec du chargement du contenu"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const handleSaveFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = faqForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    try {
      await axios.put(`/api/admin/content/faqs/${cleanSlug}`, {
        slug: cleanSlug,
        category: faqForm.category,
        isPublished: true,
        ar: { question: faqForm.questionAr.trim(), answer: faqForm.answerAr.trim() },
        fr: { question: faqForm.questionFr.trim(), answer: faqForm.answerFr.trim() },
      });
      invalidatePublicContentCache();
      setShowFaqModal(false);
      setFaqForm({ slug: "", category: "company", questionAr: "", questionFr: "", answerAr: "", answerFr: "" });
      setSuccess(t("تم حفظ السؤال الشائع بنجاح", "FAQ enregistrée avec succès"));
      void loadContent();
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل الحفظ", "Échec de l'enregistrement"));
    }
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanSlug = articleForm.slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "-");
    try {
      await axios.put(`/api/admin/content/articles/${cleanSlug}`, {
        slug: cleanSlug,
        category: articleForm.category,
        isPublished: true,
        ar: {
          title: articleForm.titleAr.trim(),
          summary: articleForm.summaryAr.trim(),
          scientificInfo: articleForm.scientificAr.trim(),
          ingredientEvidence: articleForm.scientificAr.trim(),
          traditionalUses: "",
          unprovenClaimsNotice: "",
          usageAndStorage: "",
        },
        fr: {
          title: articleForm.titleFr.trim(),
          summary: articleForm.summaryFr.trim(),
          scientificInfo: articleForm.scientificFr.trim(),
          ingredientEvidence: articleForm.scientificFr.trim(),
          traditionalUses: "",
          unprovenClaimsNotice: "",
          usageAndStorage: "",
        },
      });
      invalidatePublicContentCache();
      setShowArticleModal(false);
      setArticleForm({
        slug: "",
        category: "supplements",
        titleAr: "",
        titleFr: "",
        summaryAr: "",
        summaryFr: "",
        scientificAr: "",
        scientificFr: "",
      });
      setSuccess(t("تم حفظ المقال التثقيفي بنجاح", "Article éducatif enregistré"));
      void loadContent();
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل حفظ المقال", "Échec de l'enregistrement"));
    }
  };

  return (
    <Container fluid dir={dir}>
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 dxn-admin-header mb-4">
        <div>
          <h1 className="dxn-admin-title h3 mb-1">
            {t("إدارة المحتوى والمقالات التثقيفية", "Gestion du Contenu & Éducation")}
          </h1>
          <p className="dxn-admin-sub mb-0">
            {t(
              "إدارة مقالات مركز التثقيف، الأسئلة الشائعة، ونصوص التعريف بالشركة والمؤسس دون الحاجة لتعديل الكود.",
              "Gérez les articles éducatifs, la FAQ et les blocs institutionnels sans modifier le code."
            )}
          </p>
        </div>
        <div className="d-flex gap-2">
          <Button className="dxn-btn dxn-btn-primary btn-sm" onClick={() => setShowArticleModal(true)}>
            {t("+ مقال تثقيفي جديد", "+ Nouvel article")}
          </Button>
          <Button className="dxn-btn dxn-btn-outline btn-sm" onClick={() => setShowFaqModal(true)}>
            {t("+ سؤال شائع جديد", "+ Nouvelle FAQ")}
          </Button>
        </div>
      </div>

      {success && (
        <Alert variant="success" dismissible onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}
      {error && (
        <Alert variant="danger" dismissible onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <div className="d-flex gap-2 mb-3">
        <button
          type="button"
          className={`dxn-filter-pill ${tab === "articles" ? "active" : ""}`}
          onClick={() => setTab("articles")}
        >
          {t("المقالات التثقيفية", "Articles éducatifs")} ({articles.length})
        </button>
        <button
          type="button"
          className={`dxn-filter-pill ${tab === "faqs" ? "active" : ""}`}
          onClick={() => setTab("faqs")}
        >
          {t("الأسئلة الشائعة", "FAQ")} ({faqs.length})
        </button>
        <button
          type="button"
          className={`dxn-filter-pill ${tab === "blocks" ? "active" : ""}`}
          onClick={() => setTab("blocks")}
        >
          {t("نصوص الصفحات التعريفية", "Blocs institutionnels")} ({Object.keys(blocks).length})
        </button>
      </div>

      <div className="dxn-admin-card">
        <div className="admin-table-wrap p-3">
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" />
            </div>
          ) : tab === "articles" ? (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>{t("العنوان", "Titre")}</th>
                  <th>{t("الفئة", "Catégorie")}</th>
                  <th>{t("المصدر", "Origine")}</th>
                </tr>
              </thead>
              <tbody>
                {articles.map((art) => (
                  <tr key={art.slug}>
                    <td dir="ltr" className="small">{art.slug}</td>
                    <td>{isAr ? art.ar?.title : art.fr?.title}</td>
                    <td><Badge bg="secondary">{art.category}</Badge></td>
                    <td>
                      <Badge bg={art._isDefaultSeed ? "info" : "success"}>
                        {art._isDefaultSeed ? t("معتمد افتراضي", "Vérifié par défaut") : t("مخصص", "Personnalisé")}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : tab === "faqs" ? (
            <Table hover responsive className="align-middle mb-0">
              <thead>
                <tr>
                  <th>Slug</th>
                  <th>{t("الفئة", "Catégorie")}</th>
                  <th>{t("السؤال", "Question")}</th>
                </tr>
              </thead>
              <tbody>
                {faqs.map((faq) => (
                  <tr key={faq.slug}>
                    <td dir="ltr" className="small">{faq.slug}</td>
                    <td><Badge bg="info" text="dark">{faq.category}</Badge></td>
                    <td>{isAr ? faq.ar?.question : faq.fr?.question}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <div className="py-3">
              <p className="text-muted mb-2">
                {t(
                  "الصفحات التعريفية المفعّلة (من هي DXN، المؤسس داتوك د. ليم سيو جين) متاحة وقابلة للتعديل عبر واجهة CMS.",
                  "Blocs institutionnels actifs : About DXN & Fondateur Datuk Dr. Lim Siow Jin."
                )}
              </p>
              <ul className="small mb-0">
                {Object.keys(blocks).map((k) => (
                  <li key={k}>
                    <strong>{k}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {/* Add FAQ Modal */}
      <Modal show={showFaqModal} onHide={() => setShowFaqModal(false)} size="lg" dir={dir}>
        <Form onSubmit={handleSaveFaq}>
          <Modal.Header closeButton>
            <Modal.Title>{t("إضافة أو تعديل سؤال شائع", "Ajouter / Modifier une FAQ")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-2 mb-3">
              <Col md={6}>
                <Form.Label>Slug</Form.Label>
                <Form.Control
                  required
                  dir="ltr"
                  placeholder="cod-delivery-wilayas"
                  value={faqForm.slug}
                  onChange={(e) => setFaqForm({ ...faqForm, slug: e.target.value })}
                />
              </Col>
              <Col md={6}>
                <Form.Label>{t("الفئة", "Catégorie")}</Form.Label>
                <Form.Select
                  value={faqForm.category}
                  onChange={(e) => setFaqForm({ ...faqForm, category: e.target.value })}
                >
                  <option value="company">Company</option>
                  <option value="products">Products</option>
                  <option value="ordering">Ordering</option>
                  <option value="membership">Membership</option>
                </Form.Select>
              </Col>
            </Row>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t("السؤال (عربي)", "Question (AR)")}</Form.Label>
                  <Form.Control
                    required
                    value={faqForm.questionAr}
                    onChange={(e) => setFaqForm({ ...faqForm, questionAr: e.target.value })}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("الإجابة (عربي)", "Réponse (AR)")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    required
                    value={faqForm.answerAr}
                    onChange={(e) => setFaqForm({ ...faqForm, answerAr: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t("السؤال (فرنسي)", "Question (FR)")}</Form.Label>
                  <Form.Control
                    required
                    value={faqForm.questionFr}
                    onChange={(e) => setFaqForm({ ...faqForm, questionFr: e.target.value })}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("الإجابة (فرنسي)", "Réponse (FR)")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    required
                    value={faqForm.answerFr}
                    onChange={(e) => setFaqForm({ ...faqForm, answerFr: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowFaqModal(false)}>
              {t("إلغاء", "Annuler")}
            </Button>
            <Button type="submit" className="dxn-btn dxn-btn-primary">
              {t("حفظ السؤال", "Enregistrer")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {/* Add Article Modal */}
      <Modal show={showArticleModal} onHide={() => setShowArticleModal(false)} size="lg" dir={dir}>
        <Form onSubmit={handleSaveArticle}>
          <Modal.Header closeButton>
            <Modal.Title>{t("إضافة أو تعديل مقال تثقيفي متوافق صحياً", "Article éducatif conforme")}</Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Alert variant="warning" className="small">
              {t(
                "تنبيه امتثال: يُمنع كتابة أي ادعاء علاجي أو دوائي للمكملات الغذائية. يتم إرفاق التنبيه الصحي تلقائياً.",
                "Conformité : Aucune allégation médicale ou curative n'est autorisée. L'avertissement légal est ajouté automatiquement."
              )}
            </Alert>
            <Row className="g-2 mb-3">
              <Col md={6}>
                <Form.Label>Slug (URL)</Form.Label>
                <Form.Control
                  required
                  dir="ltr"
                  placeholder="ganoderma-daily-guide"
                  value={articleForm.slug}
                  onChange={(e) => setArticleForm({ ...articleForm, slug: e.target.value })}
                />
              </Col>
              <Col md={6}>
                <Form.Label>{t("الفئة", "Catégorie")}</Form.Label>
                <Form.Select
                  value={articleForm.category}
                  onChange={(e) => setArticleForm({ ...articleForm, category: e.target.value })}
                >
                  <option value="ganoderma">Ganoderma</option>
                  <option value="supplements">Supplements</option>
                  <option value="beverages">Beverages</option>
                  <option value="cosmetics">Cosmetics</option>
                  <option value="membership">Membership</option>
                </Form.Select>
              </Col>
            </Row>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t("العنوان (عربي)", "Titre (AR)")}</Form.Label>
                  <Form.Control
                    required
                    value={articleForm.titleAr}
                    onChange={(e) => setArticleForm({ ...articleForm, titleAr: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>{t("الملخص (عربي)", "Résumé (AR)")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    required
                    value={articleForm.summaryAr}
                    onChange={(e) => setArticleForm({ ...articleForm, summaryAr: e.target.value })}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("المعلومات العلمية الموثقة (عربي)", "Informations scientifiques (AR)")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    required
                    value={articleForm.scientificAr}
                    onChange={(e) => setArticleForm({ ...articleForm, scientificAr: e.target.value })}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-2">
                  <Form.Label>{t("العنوان (فرنسي)", "Titre (FR)")}</Form.Label>
                  <Form.Control
                    required
                    value={articleForm.titleFr}
                    onChange={(e) => setArticleForm({ ...articleForm, titleFr: e.target.value })}
                  />
                </Form.Group>
                <Form.Group className="mb-2">
                  <Form.Label>{t("الملخص (فرنسي)", "Résumé (FR)")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    required
                    value={articleForm.summaryFr}
                    onChange={(e) => setArticleForm({ ...articleForm, summaryFr: e.target.value })}
                  />
                </Form.Group>
                <Form.Group>
                  <Form.Label>{t("المعلومات العلمية الموثقة (فرنسي)", "Informations scientifiques (FR)")}</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    required
                    value={articleForm.scientificFr}
                    onChange={(e) => setArticleForm({ ...articleForm, scientificFr: e.target.value })}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setShowArticleModal(false)}>
              {t("إلغاء", "Annuler")}
            </Button>
            <Button type="submit" className="dxn-btn dxn-btn-primary">
              {t("نشر المقال", "Publier")}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </Container>
  );
};

export default AdminContentPage;
