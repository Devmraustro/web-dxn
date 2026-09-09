import React from "react";
import { useLanguage } from "../context/LanguageContext";
import { useCart } from "../context/CartContext";
import { Container, Table, Button, Alert } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

const CartPage = () => {
  const { language } = useLanguage();
  const { items, increaseQuantity, decreaseQuantity, subtotal, total } = useCart();
  const navigate = useNavigate();

  return (
    <>
      <Container>
        <h2 className="mb-4">{language === "ar" ? "سلة التسوق" : "Panier"}</h2>

        {items.length === 0 ? (
          <p>{language === "ar" ? "لا توجد منتجات في السلة" : "Panier vide"}</p>
        ) : (
          <Container>
            <Table striped bordered hover>
              <caption style={{ captionSide: "top" }}>
                {language === "ar" ? "محتويات السلة" : "Contenu du panier"}
              </caption>
              <thead>
                <tr>
                  <th>{language === "ar" ? "المنتج" : "Produit"}</th>
                  <th>{language === "ar" ? "الكمية" : "Quantité"}</th>
                  <th>{language === "ar" ? "السعر" : "Prix"}</th>
                  <th>{language === "ar" ? "المجموع" : "Total"}</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.name}</td>
                    <td>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => decreaseQuantity(index)}
                        aria-label={language === "ar" ? "تقليل الكمية" : "Diminuer la quantité"}
                        style={{ padding: 0 }}
                      >
                        -
                      </Button>
                      <span aria-live="polite">{item.quantity}</span>
                      <Button
                        variant="link"
                        size="sm"
                        onClick={() => increaseQuantity(index)}
                        aria-label={language === "ar" ? "زيادة الكمية" : "Augmenter la quantité"}
                        style={{ padding: 0 }}
                      >
                        +
                      </Button>
                    </td>
                    <td>{item.unitPrice} DA</td>
                    <td>{item.totalPrice} DA</td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <div className="cart-footer mt-4">
              <div className="row">
                <div className="col-6">
                  <strong>{language === "ar" ? "المجموع الفرعي" : "Sous-total"}:</strong> {subtotal} DA
                </div>
                <div className="col-6">
                  <strong>{language === "ar" ? "الشحن" : "Frais de port"}:</strong> 0 DA
                </div>
              </div>
              <div className="row mt-3">
                <div className="col-12">
                  <hr />
                </div>
              </div>
              <div className="row">
                <div className="col-12">
                  <strong>{language === "ar" ? "المجموع" : "Total"}:</strong> {total} DA
                </div>
              </div>
            </div>
          </Container>
        )}

        <Button
          variant="primary"
          size="lg"
          className="w-100"
          onClick={() => navigate("/checkout")}
          style={{ marginTop: "20px" }}
          disabled={items.length === 0}
          aria-disabled={items.length === 0}
        >
          {language === "ar" ? "متابعة الدفع" : "Procéder au paiement"}
        </Button>
      </Container>
    </>
  );
};

export default CartPage;