import { useEffect, useState } from "react";
import logo from "../assets/logo.png";
import "./PublicEstimate.css";

const API_BASE = "";

function money(value) {
  return `£${Number(value || 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function getFirstName(name) {
  if (!name) return "there";

  return name.trim().split(" ")[0];
}

function PublicEstimate({ navData }) {
  const token =
    navData?.token || window.location.pathname.split("/estimate/")[1];

  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);

  useEffect(() => {
    async function loadEstimate() {
      try {
        const res = await fetch(`${API_BASE}/api/public-estimates/${token}`);

        if (!res.ok) {
          throw new Error("Estimate not found");
        }

        const estimateData = await res.json();
        setData(estimateData);

        await fetch(`${API_BASE}/api/public-estimates/${token}/view`, {
          method: "POST",
        });
      } catch (err) {
        setError(err.message || "Could not load estimate");
      }
    }

    if (token) {
      loadEstimate();
    }
  }, [token]);

  if (error) {
    return (
      <div className="publicEstimatePage">
        <div className="publicEstimateCard publicEstimateError">
          <img src={logo} alt="JNR Plastering & Building" />
          <h1>Estimate unavailable</h1>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="publicEstimatePage">
        <div className="publicEstimateCard publicEstimateError">
          <img src={logo} alt="JNR Plastering & Building" />
          <h1>Loading estimate...</h1>
        </div>
      </div>
    );
  }

  const { job, estimate } = data;

  const company = estimate.companySnapshot || estimate.fromSnapshot || {};
  const customer = estimate.customerSnapshot || job.customerDetails || {};
  const items = Array.isArray(estimate.items) ? estimate.items : [];

  const customerName = customer.name || job.customerDetails?.name || "";
  const friendlyName = getFirstName(customerName);

  return (
    <div className="publicEstimatePage">
      <div className="publicEstimateToolbar">
        <div>
          <strong>JNR Plastering & Building</strong>
          <span>Professional estimate prepared for review</span>
        </div>

        <button type="button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
      </div>

      <main className="publicEstimateCard">
        <section className="publicEstimateHero">
          <div className="publicEstimateBrandBlock">
            <img src={logo} alt="JNR Plastering & Building" />

            <div>
              <span>Prepared by</span>
              <strong>{company.name || "JNR Plastering & Building"}</strong>
              <p>{company.owner || "Joshua Roberton"}</p>
            </div>
          </div>

          <div className="publicEstimateHeroTotal">
            <span>Estimate Total</span>
            <strong>{money(estimate.total)}</strong>
            <p>{estimate.number || estimate.quoteNumber || "Estimate"}</p>
          </div>
        </section>

        <section className="publicEstimateIntro">
          <p className="publicEstimateEyebrow">Estimate ready</p>

          <h1>Your estimate is ready.</h1>

          <p>
            Thank you for inviting JNR Plastering & Building to quote for your
            project. The estimate below has been prepared for the works at{" "}
            <strong>{job.address}</strong>.
          </p>
        </section>

        <section className="publicEstimateProjectCard">
          <div>
            <span>Project</span>
            <strong>{job.name}</strong>
          </div>

          <div>
            <span>Customer</span>
            <strong>{customerName || "—"}</strong>
          </div>

          <div>
            <span>Estimate No.</span>
            <strong>{estimate.number || estimate.quoteNumber || "—"}</strong>
          </div>

          <div>
            <span>Date Issued</span>
            <strong>{formatDate(estimate.issuedAt)}</strong>
          </div>
        </section>

        <section className="publicEstimateSection">
          <div className="publicEstimateSectionHeader">
            <div>
              <p className="publicEstimateEyebrow">Scope</p>
              <h2>Scope of Works</h2>
            </div>

            <span>
              {items.length} item{items.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="publicEstimateItems">
            {items.map((item, index) => {
              const amount = Number(item.rate || 0) * Number(item.qty || 0);

              return (
                <article key={item.id || index} className="publicEstimateItem">
                  <div className="publicEstimateItemNumber">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div className="publicEstimateItemContent">
                    <h3>{item.description || "Work item"}</h3>

                    {item.details && <p>{item.details}</p>}
                  </div>

                  <strong>{money(amount)}</strong>
                </article>
              );
            })}
          </div>
        </section>

        <section className="publicEstimateTotalsPanel">
          <div>
            <span>Subtotal</span>
            <strong>{money(estimate.subtotal)}</strong>
          </div>

          <div>
            <span>VAT</span>
            <strong>{money(estimate.vatAmount)}</strong>
          </div>

          <div className="publicEstimateGrandTotal">
            <span>Total</span>
            <strong>{money(estimate.total)}</strong>
          </div>
        </section>

        <section className="publicEstimateNextBox">
          <div>
            <p className="publicEstimateEyebrow">Next step</p>
            <h2>Review the estimate</h2>
            <p>
              If everything looks right, reply to the email you received and we
              can confirm the next step. If you have any questions, Josh will be
              happy to talk it through.
            </p>
          </div>

          <button type="button" disabled>
            Accept Estimate Coming Soon
          </button>
        </section>

        {estimate.notes && (
          <section className="publicEstimateTerms">
            <button type="button" onClick={() => setTermsOpen((prev) => !prev)}>
              <span>Terms & Conditions</span>
              <strong>{termsOpen ? "−" : "+"}</strong>
            </button>

            {termsOpen && <pre>{estimate.notes}</pre>}
          </section>
        )}

        <footer className="publicEstimateFooter">
          <div>
            <strong>Questions?</strong>
            <p>
              Reply to the email you received, or contact{" "}
              {company.owner || "Josh"} directly.
            </p>
          </div>

          <div>
            <span>{company.phone || "07964 679976"}</span>
            <span>{company.email || "info@jnrplasteringandbuilding.com"}</span>
            <span>{company.website || "jnrplasteringandbuilding.com"}</span>
          </div>
        </footer>
      </main>
    </div>
  );
}

export default PublicEstimate;

