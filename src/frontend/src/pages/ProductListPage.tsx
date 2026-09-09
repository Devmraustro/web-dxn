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

  if (loading) return <div>Loading products...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <>
      <Container>
        <h1 className="mb-4">{language === "ar" ? "المنتجات" : "Produits"}</h1>
        <Row>
          {products.map((product) => (
            <Col key={product._id} xs={12} sm={6} md={4} xl={3}>
              <ProductCard product={product} language={language} />
            </Col>
          ))}
        </Row>
        {products.length === 0 && <p>{language === "ar" ? "لا توجد منتجات" : "Aucun produit"}</p>}
      </Container>
    </>
  );
};

export default ProductListPage;