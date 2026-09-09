import React, { useEffect, useState } from "react";
import { useLanguage } from "../context/LanguageContext";
import axios from "axios";
import ProductCard from "../components/ProductCard";
import { Container, Row, Col } from "react-bootstrap";

const ProductListPage = () => {
  const { language } = useLanguage();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await axios.get(`/api/products?language=${language}`);
        setProducts(response.data.data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading products:", err);
        setError("Failed to load products");
        setLoading(false);
      }
    };

    loadProducts();
  }, [language]);

  if (loading) {
    return <div className="text-center mt-5 py-5">{language === "ar" ? "جارٍ تحميل المنتجات..." : "Chargement des produits..."}</div>;
  }
  if (error) {
    return (
      <Container className="mt-5" style={{ maxWidth: 560 }}>
        <div className="alert alert-danger" role="alert">
          {language === "ar" ? "فشل تحميل المنتجات" : "Échec du chargement des produits"}
        </div>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <h1 className="mb-4">{language === "ar" ? "المنتجات" : "Produits"}</h1>
        {products.length === 0 ? (
          <p className="text-center py-5 text-muted">
            {language === "ar" ? "لا توجد منتجات حالياً" : "Aucun produit disponible"}
          </p>
        ) : (
          <Row>
            {products.map((product) => (
              <Col key={product._id} xs={12} sm={6} md={4} xl={3} className="mb-4 d-flex">
                <ProductCard product={product} language={language} />
              </Col>
            ))}
          </Row>
        )}
      </Container>
    </>
  );
};

export default ProductListPage;