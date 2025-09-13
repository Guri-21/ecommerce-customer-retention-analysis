import streamlit as st
import pandas as pd

st.set_page_config(page_title="E-commerce Analysis", layout="wide")

st.title("🛍️ E-commerce Customer Retention Analysis")
st.markdown("**Google Data Analytics Apprenticeship Project**")
st.markdown("---")

# Key Metrics
st.header("📊 Key Business Metrics")
col1, col2, col3, col4 = st.columns(4)

with col1:
    st.metric("Total Customers", "96,096")
with col2:
    st.metric("Retention Rate", "3.12%")
with col3:
    st.metric("Repeat Customers", "2,986")
with col4:
    st.metric("Avg Order Value", "$137")

st.markdown("---")

# Technical Skills Demo
st.header("🎯 Technical Skills Demonstrated")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Advanced SQL Queries")
    st.code('''
-- Problem Solving: Data Quality Investigation
SELECT 
    COUNT(DISTINCT customer_id) as unique_customer_ids,
    COUNT(DISTINCT customer_unique_id) as unique_customers,
    COUNT(*) as total_orders
FROM customers c
JOIN orders o ON c.customer_id = o.customer_id;

-- Result: Found data quality issue!
-- customer_id: 99,441 | customer_unique_id: 96,096
    ''', language='sql')

    st.code('''
-- Customer Retention Analysis with Window Functions
WITH customer_orders AS (
    SELECT 
        c.customer_unique_id,
        ROW_NUMBER() OVER (
            PARTITION BY c.customer_unique_id 
            ORDER BY o.order_purchase_timestamp
        ) as order_number
    FROM customers c
    JOIN orders o ON c.customer_id = o.customer_id
    WHERE o.order_status = 'delivered'
)
SELECT 
    CASE 
        WHEN COUNT(*) = 1 THEN 'One-time'
        WHEN COUNT(*) = 2 THEN 'Two-time'
        ELSE 'Loyal'
    END as segment,
    COUNT(DISTINCT customer_unique_id) as customers
FROM customer_orders
GROUP BY customer_unique_id;
    ''', language='sql')

with col2:
    st.subheader("Problem-Solving Journey")
    
    st.write("**🔍 Critical Thinking & Investigation**")
    st.success("✅ Identified impossible 0% retention rate")
    st.success("✅ Investigated data structure and relationships")
    st.success("✅ Discovered customer_id ≠ customer_unique_id")
    st.success("✅ Corrected analysis: 3.12% actual retention")
    
    st.write("**📊 Business Analysis Skills**")
    st.write("• RFM customer segmentation")
    st.write("• Cohort retention analysis") 
    st.write("• Revenue impact calculations")
    st.write("• Customer lifetime value modeling")
    
    st.write("**🛠️ Technical Implementation**")
    st.write("• Complex JOINs across 6 tables")
    st.write("• Window functions (ROW_NUMBER, LAG, NTILE)")
    st.write("• CTEs for readable complex queries")
    st.write("• Statistical analysis and segmentation")

# Customer Segments
st.header("💎 Customer Segmentation Results")
segment_data = {
    'Segment': ['New Customers', 'Potential Loyalists', 'Loyal Customers', 'Champions'],
    'Count': [93,110, 2,745, 203, 38],
    'Percentage': ['96.9%', '2.9%', '0.2%', '0.04%'],
    'Avg Orders': [1, 2, 3, 4.5],
    'Business Priority': ['Medium', 'High', 'Very High', 'Critical']
}

segment_df = pd.DataFrame(segment_data)
st.dataframe(segment_df, use_container_width=True)

# Business Impact
st.header("💰 Business Impact & Strategic Recommendations")

col1, col2, col3 = st.columns(3)

with col1:
    st.subheader("Current State Analysis")
    st.metric("Retention Rate", "3.12%", delta="-6.88% vs industry avg")
    st.write("**Key Findings:**")
    st.write("• 96.9% of customers make only 1 purchase")
    st.write("• Only 2,986 customers return for 2nd purchase")
    st.write("• Clear retention problem = revenue opportunity")

with col2:
    st.subheader("Revenue Opportunity")
    st.metric("Target Retention", "10%", delta="+6.88% improvement")
    st.metric("Revenue Impact", "$2.3M", delta="Annual potential")
    st.write("**If retention improves to 10%:**")
    st.write("• 6,623 additional repeat customers")
    st.write("• $347 average repeat purchase value")
    st.write("• 220% ROI on retention campaigns")

with col3:
    st.subheader("Strategic Actions")
    st.write("🎯 **Immediate Priorities**")
    st.write("• Email remarketing to 'Potential Loyalists'")
    st.write("• VIP program for 'Champions' segment")
    st.write("• Win-back campaigns using purchase history")
    
    st.write("📈 **Success Metrics**")
    st.write("• Track monthly repeat purchase rate")
    st.write("• Monitor customer lifetime value by segment")
    st.write("• A/B test retention campaign effectiveness")

# Footer
st.markdown("---")
st.subheader("🏆 Skills Demonstrated for Google Apprenticeship")

col1, col2 = st.columns(2)
with col1:
    st.write("✅ **SQL Programming**: Complex queries, JOINs, window functions")
    st.write("✅ **Critical Thinking**: Questioned impossible results, found root cause")
    st.write("✅ **Problem Solving**: Adapted analysis when data didn't match expectations")

with col2:
    st.write("✅ **Data Analysis**: Pattern recognition, statistical segmentation")
    st.write("✅ **Business Impact**: Revenue calculations, strategic recommendations")
    st.write("✅ **Independent Work**: End-to-end project from data to insights")

st.markdown("**Technologies:** Python • SQL • Pandas • Streamlit • Statistical Analysis")