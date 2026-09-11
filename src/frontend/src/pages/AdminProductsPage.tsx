import React, { useCallback, useEffect, useRef, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import {
  Container,
  Row,
  Col,
  Card,
  Table,
  Button,
  Form,
  Badge,
  Alert,
  Modal,
  Spinner,
  Image as BsImage,
} from "react-bootstrap";
import axios from "axios";

interface AdminProductRow {
  _id: string;
  sku: string;
  slug: string;
  price: number;
  stockQuantity: number;
  isActive: boolean;
  isFeatured?: boolean;
  image?: string;
  images?: string[];
  _titles?: Record<string, string>;
  _isPlaceholderSeed?: boolean;
}

interface TranslationDoc {
  language: "ar" | "fr";
  title?: string;
  description?: string;
  specifications?: string;
  size?: string;
}

interface ProductForm {
  sku: string;
  slug: string;
  price: string;
  stockQuantity: string;
  isActive: boolean;
  image: string;
  translations: {
    ar: { title: string; description: string; specifications: string };
    fr: { title: string; description: string; specifications: string };
  };
}

const EMPTY_FORM: ProductForm = {
  sku: "",
  slug: "",
  price: "",
  stockQuantity: "",
  isActive: true,
  image: "",
  translations: {
    ar: { title: "", description: "", specifications: "" },
    fr: { title: "", description: "", specifications: "" },
  },
};

const AdminProductsPage = () => {
  const { language } = useLanguage();
  const t = useCallback((ar: string, fr: string) => (language === "ar" ? ar : fr), [language]);

  const [products, setProducts] = useState<AdminProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminProductRow | null>(null);
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const showSuccessTmp = (msg: string) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3500);
  };

  const loadProducts = useCallback(async () => {
    try {
      const response = await axios.get("/api/admin/catalog");
      setProducts(Array.isArray(response.data?.data?.products) ? response.data.data.products : []);
      setError(null);
    } catch (err: any) {
      console.error("Error loading admin catalog:", err);
      setError(t("فشل تحميل المنتجات", "Échec du chargement des produits"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const statusText = (row: AdminProductRow) => {
    if (row._isPlaceholderSeed) return t("نموذج أولي (seed)", "Placeholder (seed)");
    if (row.isActive) return t("مفعّل", "Actif");
    return t("موقوف", "Inactif");
  };

  const statusVariant = (row: AdminProductRow) => {
    if (row._isPlaceholderSeed) return "secondary";
    return row.isActive ? "success" : "warning";
  };

  const displayTitle = (row: AdminProductRow) => {
    const want = language === "ar" ? "ar" : "fr";
    if (row._titles) return row._titles[want] || row._titles.ar || row._titles.fr || row.sku;
    return row.sku;
  };

  const openCreate = () => {
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      sku: `DXN-${Date.now().toString(36).toUpperCase()}`,
    });
    setFormError(null);
    setShowModal(true);
  };

  const openEdit = async (row: AdminProductRow) => {
    setFormError(null);
    try {
      const response = await axios.get(`/api/admin/products/${row._id}`);
      const data = response.data?.data;
      const tArr: TranslationDoc[] = Array.isArray(data?.translations) ? data.translations : [];
      const byLang = (l: "ar" | "fr") =>
        tArr.find((d) => d.language === l) || { language: l };
      setEditing(row);
      setForm({
        sku: data?.sku || "",
        slug: data?.slug || "",
        price: String(Number(data?.price) || 0),
        stockQuantity: String(Number(data?.stockQuantity) || 0),
        isActive: data?.isActive !== false,
        image: data?.image || (Array.isArray(data?.images) ? data.images[0] || "" : ""),
        translations: {
          ar: {
            title: byLang("ar").title || "",
            description: byLang("ar").description || "",
            specifications: byLang("ar").specifications || "",
          },
          fr: {
            title: byLang("fr").title || "",
            description: byLang("fr").description || "",
            specifications: byLang("fr").specifications || "",
          },
        },
      });
      setShowModal(true);
    } catch (err: any) {
      setError(
        err?.response?.data?.message || t("تعذر تحميل المنتج للتعديل", "Impossible de charger le produit")
      );
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  };

  const updateField = (path: string, value: any) => {
    setForm((prev) => {
      const next = { ...prev };
      const parts = path.split(".");
      let cursor: any = next;
      for (let i = 0; i < parts.length - 1; i++) {
        cursor = cursor[parts[i]];
      }
      cursor[parts[parts.length - 1]] = value;
      return next;
    });
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setUploadingImage(true);
    setFormError(null);
    try {
      const fd = new FormData();
      fd.append("image", file);
      const response = await axios.post("/api/upload/image", fd);
      const url = response.data?.data?.url;
      if (url) {
        updateField("image", url);
        showSuccessTmp(t("تم رفع الصورة", "Image téléchargée"));
      }
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || t("فشل رفع الصورة", "Échec du téléchargement de l'image")
      );
    } finally {
      setUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const validateLocal = (): string | null => {
    if (!form.sku.trim()) return t("الرقم المرجعي (SKU) مطلوب", "Le SKU est requis");
    if (!form.slug.trim()) return t("الرابط (slug) مطلوب", "Le slug est requis");
    const titleAr = form.translations.ar.title.trim();
    const titleFr = form.translations.fr.title.trim();
    if (!titleAr && !titleFr) {
      return t("أدخل اسم المنتج بالعربية أو الفرنسية على الأقل", "Saisissez au moins un nom (arabe ou français)");
    }
    const price = Number(form.price);
    if (!Number.isFinite(price) || price < 0) {
      return t("سعر غير صحيح — يجب أن يكون رقماً غير سالب", "Prix invalide — doit être un nombre positif ou nul");
    }
    if (price > 10_000_000) {
      return t("السعر كبير جداً", "Prix trop élevé");
    }
    const stock = Number(form.stockQuantity);
    if (!Number.isInteger(stock) || stock < 0) {
      return t("كمية المخزون يجب أن تكون عدداً صحيحاً غير سالب", "Le stock doit être un entier positif ou nul");
    }
    if (stock > 1_000_000) {
      return t("كمية المخزون كبيرة جداً", "Stock trop élevé");
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const localError = validateLocal();
    if (localError) {
      setFormError(localError);
      return;
    }
    setSaving(true);
    setFormError(null);

    const payload = {
      sku: form.sku.trim(),
      slug: form.slug.trim(),
      price: Number(form.price),
      stockQuantity: Number(form.stockQuantity),
      isActive: form.isActive,
      image: form.image || undefined,
      translations: {
        ar: {
          title: form.translations.ar.title.trim() || undefined,
          description: form.translations.ar.description.trim() || undefined,
          specifications: form.translations.ar.specifications.trim() || undefined,
        },
        fr: {
          title: form.translations.fr.title.trim() || undefined,
          description: form.translations.fr.description.trim() || undefined,
          specifications: form.translations.fr.specifications.trim() || undefined,
        },
      },
    };

    try {
      if (editing) {
        await axios.put(`/api/products/${editing._id}`, payload);
        showSuccessTmp(t("تم تحديث المنتج", "Produit mis à jour"));
      } else {
        await axios.post("/api/products", payload);
        showSuccessTmp(t("تم إنشاء المنتج", "Produit créé"));
      }
      closeModal();
      void loadProducts();
    } catch (err: any) {
      setFormError(
        err?.response?.data?.message || t("فشل حفظ المنتج", "Échec de l'enregistrement du produit")
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: AdminProductRow) => {
    setTogglingId(row._id);
    setError(null);
    try {
      await axios.put(`/api/products/${row._id}`, { isActive: !row.isActive });
      setProducts((prev) =>
        prev.map((p) => (p._id === row._id ? { ...p, isActive: !p.isActive } : p))
      );
      showSuccessTmp(
        !row.isActive
          ? t("تم تفعيل المنتج", "Produit activé")
          : t("تم إيقاف المنتج", "Produit désactivé")
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || t("فشل تغيير حالة المنتج", "Échec du changement d'état"));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <>
      <Container fluid>
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-4">
          <div>
            <h1 className="mb-1">{t("إدارة المنتجات", "Gestion des produits")}</h1>
            <p className="text-muted mb-0 small">
              {t(
                "الأسعار والمخزون والحالة تُحفظ على الخادم وتكون مرجعية أثناء الطلب.",
                "Prix, stock et statut sont enregistrés côté serveur et restent la référence à la commande."
              )}
            </p>
          </div>
          <Button className="dxn-btn dxn-btn-primary" onClick={openCreate}>
            {t("+ إضافة منتج", "+ Ajouter un produit")}
          </Button>
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

        {loading ? (
          <div className="text-center py-5">
            <Spinner animation="border" />
            <p className="mt-2">{t("جاري التحميل...", "Chargement...")}</p>
          </div>
        ) : products.length === 0 ? (
          <Alert variant="info">
            {t("لا توجد منتجات بعد. أنشئ أول منتج.", "Aucun produit. Créez le premier.")}
          </Alert>
        ) : (
          <Card>
            <div className="admin-table-wrap">
              <Table striped hover responsive className="mb-0 align-middle">
                <thead>
                  <tr>
                    <th aria-label={t("الصورة", "Image")}></th>
                    <th>{t("المنتج", "Produit")}</th>
                    <th>SKU</th>
                    <th>{t("السعر (دج)", "Prix (DA)")}</th>
                    <th>{t("المخزون", "Stock")}</th>
                    <th>{t("الحالة", "Statut")}</th>
                    <th style={{ minWidth: 180 }}>{t("إجراءات", "Actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => (
                    <tr key={p._id} aria-invalid={p._isPlaceholderSeed || undefined}>
                      <td>
                        {p.image ? (
                          <BsImage
                            src={p.image}
                            thumbnail
                            width={48}
                            height={48}
                            style={{ objectFit: "cover" }}
                            alt={displayTitle(p)}
                          />
                        ) : (
                          <div
                            style={{
                              width: 48,
                              height: 48,
                              background: "#eef1ee",
                              borderRadius: 6,
                              display: "inline-block",
                            }}
                            aria-hidden="true"
                          />
                        )}
                      </td>
                      <td>
                        <div className="fw-semibold">{displayTitle(p)}</div>
                        <small className="text-muted">{p.slug}</small>
                      </td>
                      <td>{p.sku}</td>
                      <td>{p.price.toLocaleString()} DA</td>
                      <td>
                        <span className={p.stockQuantity <= 0 ? "text-danger" : undefined}>
                          {p.stockQuantity}
                        </span>
                      </td>
                      <td>
                        <Badge pill bg={statusVariant(p)}>
                          {statusText(p)}
                        </Badge>
                      </td>
                      <td>
                        <div className="d-flex gap-2 flex-wrap">
                          <Button variant="outline-primary" size="sm" onClick={() => openEdit(p)}>
                            {t("تعديل", "Modifier")}
                          </Button>
                          <Button
                            variant={p.isActive ? "outline-warning" : "outline-success"}
                            size="sm"
                            disabled={togglingId === p._id}
                            onClick={() => toggleActive(p)}
                          >
                            {togglingId === p._id
                              ? t("...", "...")
                              : p.isActive
                                ? t("إيقاف", "Désactiver")
                                : t("تفعيل", "Activer")}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          </Card>
        )}
      </Container>

      <Modal
        show={showModal}
        onHide={closeModal}
        size="lg"
        dir={language === "ar" ? "rtl" : "ltr"}
        aria-labelledby="admin-product-modal-title"
      >
        <Form onSubmit={handleSubmit}>
          <Modal.Header closeButton>
            <Modal.Title id="admin-product-modal-title">
              {editing ? t("تعديل المنتج", "Modifier le produit") : t("إضافة منتج جديد", "Nouveau produit")}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            {formError && <Alert variant="danger">{formError}</Alert>}

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    {t("الرقم المرجعي (SKU)", "Référence (SKU)")} *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={form.sku}
                    onChange={(e) => updateField("sku", e.target.value)}
                    maxLength={100}
                    required
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    {t("الرابط (slug)", "Slug")} *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={form.slug}
                    onChange={(e) => updateField("slug", e.target.value)}
                    maxLength={200}
                    required
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    {t("السعر (دج)", "Prix (DA)")} *
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={form.price}
                    onChange={(e) => updateField("price", e.target.value)}
                    required
                    isInvalid={form.price !== "" && !(Number(form.price) >= 0)}
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    {t("كمية المخزون", "Quantité en stock")} *
                  </Form.Label>
                  <Form.Control
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={form.stockQuantity}
                    onChange={(e) => updateField("stockQuantity", e.target.value)}
                    required
                    isInvalid={
                      form.stockQuantity !== "" && !(Number.isInteger(Number(form.stockQuantity)) && Number(form.stockQuantity) >= 0)
                    }
                  />
                </Form.Group>
              </Col>
              <Col md={4}>
                <Form.Group className="mb-3">
                  <Form.Label>{t("الحالة", "Statut")}</Form.Label>
                  <Form.Select
                    value={form.isActive ? "active" : "inactive"}
                    onChange={(e) => updateField("isActive", e.target.value === "active")}
                  >
                    <option value="active">{t("مفعّل", "Actif")}</option>
                    <option value="inactive">{t("موقوف", "Inactif")}</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Card className="mb-3">
              <Card.Header className="fw-semibold">
                {t("صورة المنتج", "Image du produit")}
              </Card.Header>
              <Card.Body>
                <div className="d-flex align-items-center gap-3 flex-wrap">
                  {form.image ? (
                    <BsImage
                      src={form.image}
                      thumbnail
                      width={96}
                      height={96}
                      style={{ objectFit: "cover" }}
                      alt={t("صورة المنتج", "Image du produit")}
                    />
                  ) : (
                    <div
                      style={{
                        width: 96,
                        height: 96,
                        background: "#eef1ee",
                        borderRadius: 8,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#8a8a8a",
                        fontSize: "0.8rem",
                        textAlign: "center",
                      }}
                    >
                      {t("لا صورة", "Aucune image")}
                    </div>
                  )}
                  <div>
                    <Form.Control
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      onChange={handleImageFile}
                      disabled={uploadingImage}
                      aria-label={t("رفع صورة المنتج", "Télécharger l'image")}
                    />
                    <Form.Text className="text-muted">
                      {uploadingImage
                        ? t("جارٍ الرفع...", "Téléchargement...")
                        : t("JPEG, PNG, GIF, WebP — حتى 5 ميغابايت", "JPEG, PNG, GIF, WebP — max 5 Mo")}
                    </Form.Text>
                    {form.image && (
                      <Button
                        variant="link"
                        size="sm"
                        className="p-0 ms-2"
                        onClick={() => updateField("image", "")}
                      >
                        {t("إزالة الصورة", "Retirer l'image")}
                      </Button>
                    )}
                  </div>
                </div>
              </Card.Body>
            </Card>

            <Row>
              <Col md={6}>
                <Card className="mb-3 h-100">
                  <Card.Header className="fw-semibold">العربية</Card.Header>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("اسم المنتج (عربي)", "Nom (arabe)")}</Form.Label>
                      <Form.Control
                        type="text"
                        value={form.translations.ar.title}
                        onChange={(e) => updateField("translations.ar.title", e.target.value)}
                        maxLength={300}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("الوصف (عربي)", "Description (arabe)")}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={form.translations.ar.description}
                        onChange={(e) => updateField("translations.ar.description", e.target.value)}
                        maxLength={2000}
                      />
                    </Form.Group>
                    <Form.Group className="mb-0">
                      <Form.Label>{t("المواصفات (عربي)", "Spécifications (arabe)")}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={form.translations.ar.specifications}
                        onChange={(e) => updateField("translations.ar.specifications", e.target.value)}
                        maxLength={5000}
                      />
                    </Form.Group>
                  </Card.Body>
                </Card>
              </Col>
              <Col md={6}>
                <Card className="mb-3 h-100">
                  <Card.Header className="fw-semibold">Français</Card.Header>
                  <Card.Body>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("اسم المنتج (فرنسي)", "Nom (français)")}</Form.Label>
                      <Form.Control
                        type="text"
                        value={form.translations.fr.title}
                        onChange={(e) => updateField("translations.fr.title", e.target.value)}
                        maxLength={300}
                      />
                    </Form.Group>
                    <Form.Group className="mb-3">
                      <Form.Label>{t("الوصف (فرنسي)", "Description (français)")}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={form.translations.fr.description}
                        onChange={(e) => updateField("translations.fr.description", e.target.value)}
                        maxLength={2000}
                      />
                    </Form.Group>
                    <Form.Group className="mb-0">
                      <Form.Label>{t("المواصفات (فرنسي)", "Spécifications (français)")}</Form.Label>
                      <Form.Control
                        as="textarea"
                        rows={3}
                        value={form.translations.fr.specifications}
                        onChange={(e) => updateField("translations.fr.specifications", e.target.value)}
                        maxLength={5000}
                      />
                    </Form.Group>
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={closeModal}>
              {t("إلغاء", "Annuler")}
            </Button>
            <Button type="submit" className="dxn-btn dxn-btn-primary" disabled={saving}>
              {saving ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-2" />
                  {t("جارٍ الحفظ...", "Enregistrement...")}
                </>
              ) : editing ? (
                t("حفظ التغييرات", "Enregistrer")
              ) : (
                t("إنشاء المنتج", "Créer le produit")
              )}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </>
  );
};

export default AdminProductsPage;