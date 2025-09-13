import streamlit as st
import pandas as pd
import sqlite3
import plotly.express as px
import plotly.graph_objects as go
from plotly.subplots import make_subplots

st.set_page_config(page_title="E-commerce Analysis", layout="wide")

st.title("🛍️ Interactive E-commerce Customer Retention Analysis")
st.markdown("**Data Analytics Project**")
st.markdown("---")

# Sidebar for interactivity
st.sidebar.header("🎛️ Interactive Controls")
st.sidebar.markdown("Adjust parameters to explore different scenarios:")

# Interactive filters
retention_target = st.sidebar.slider(
    "🎯 Target Retention Rate (%)", 
    min_value=3.12, 
    max_value=15.0, 
    value=10.0, 
    step=0.1
)

avg_order_value = st.sidebar.number_input(
    "💰 Average Order Value ($)", 
    min_value=50, 
    max_value=500, 
    value=137, 
    step=10
)

campaign_cost = st.sidebar.number_input(
    "📧 Campaign Cost per Customer ($)", 
    min_value=5, 
    max_value=50, 
    value=25, 
    step=5
)

# Segment selector
segment_focus = st.sidebar.selectbox(
    "🎯 Focus Customer Segment",
    ["All Customers", "Potential Loyalists", "New Customers", "At-Risk Customers"]
)

st.sidebar.markdown("---")
st.sidebar.info("💡 **Tip**: Adjust the sliders above to see how different strategies impact revenue!")

# Data loading function (simplified for demo)
@st.cache_data
def load_basic_data():
    # Using known values for interactivity
    return {
        'total_customers': 96096,
        'repeat_customers': 2986,
        'current_retention': 3.12,
        'avg_order_value': 137
    }

data = load_basic_data()

# Calculate dynamic metrics based on user input
current_retention = data['current_retention']
total_customers = data['total_customers']
improvement_percentage = retention_target - current_retention
additional_customers = int(total_customers * (improvement_percentage / 100))
revenue_opportunity = additional_customers * avg_order_value
campaign_investment = additional_customers * campaign_cost
roi = ((revenue_opportunity - campaign_investment) / campaign_investment * 100) if campaign_investment > 0 else 0

# Main metrics with interactivity
st.header("📊 Dynamic Business Impact Calculator")

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Total Customers", f"{total_customers:,}")
with col2:
    st.metric("Current Retention", f"{current_retention}%")
with col3:
    st.metric("Target Retention", f"{retention_target}%", delta=f"{improvement_percentage:.1f}%")
with col4:
    st.metric("Additional Customers", f"{additional_customers:,}")

# Interactive revenue calculator
st.markdown("---")
st.header("💰 Interactive Revenue Impact Calculator")

col1, col2, col3 = st.columns(3)
with col1:
    st.metric("Revenue Opportunity", f"${revenue_opportunity:,.0f}", delta="Annual")
with col2:
    st.metric("Campaign Investment", f"${campaign_investment:,.0f}")
with col3:
    roi_color = "normal" if roi > 100 else "inverse"
    st.metric("ROI", f"{roi:.0f}%", delta=None if roi < 100 else "Profitable!")

# Interactive chart
st.header("📈 Interactive Revenue Projection")

# Create data for the chart
months = list(range(1, 13))
current_revenue = [total_customers * current_retention/100 * avg_order_value / 12] * 12
projected_revenue = [total_customers * retention_target/100 * avg_order_value / 12] * 12
cumulative_improvement = [projected_revenue[i] - current_revenue[i] for i in range(12)]

chart_data = pd.DataFrame({
    'Month': months,
    'Current Revenue': current_revenue,
    'Projected Revenue': projected_revenue,
    'Additional Revenue': cumulative_improvement
})

fig = px.line(chart_data, x='Month', y=['Current Revenue', 'Projected Revenue'], 
              title=f"Monthly Revenue: Current vs {retention_target}% Retention Target",
              labels={'value': 'Monthly Revenue ($)', 'variable': 'Scenario'})
fig.add_bar(x=chart_data['Month'], y=chart_data['Additional Revenue'], 
            name='Additional Revenue', opacity=0.6)
st.plotly_chart(fig, use_container_width=True)

# Interactive customer segments
st.header("💎 Interactive Customer Segment Analysis")

segment_selector = st.radio(
    "Select segment to analyze:",
    ["Overview", "New Customers", "Potential Loyalists", "Loyal Customers", "Champions"],
    horizontal=True
)

# Segment data
segments_info = {
    "Overview": {
        "count": 96096,
        "description": "Complete customer base analysis",
        "retention_rate": 3.12,
        "opportunity": "Massive untapped potential"
    },
    "New Customers": {
        "count": 93110,
        "description": "Customers with exactly 1 order",
        "retention_rate": 0,
        "opportunity": "Primary target for retention campaigns"
    },
    "Potential Loyalists": {
        "count": 2745,
        "description": "Customers with 2 orders",
        "retention_rate": 100,
        "opportunity": "High-value segment for loyalty programs"
    },
    "Loyal Customers": {
        "count": 203,
        "description": "Customers with 3 orders",
        "retention_rate": 100,
        "opportunity": "VIP treatment and referral programs"
    },
    "Champions": {
        "count": 38,
        "description": "Customers with 4+ orders",
        "retention_rate": 100,
        "opportunity": "Brand ambassadors and case studies"
    }
}

selected_segment = segments_info[segment_selector]

col1, col2, col3, col4 = st.columns(4)
with col1:
    st.metric("Segment Size", f"{selected_segment['count']:,}")
with col2:
    st.metric("Current Retention", f"{selected_segment['retention_rate']}%")
with col3:
    percentage = (selected_segment['count'] / total_customers) * 100
    st.metric("% of Total", f"{percentage:.1f}%")
with col4:
    potential_value = selected_segment['count'] * avg_order_value
    st.metric("Segment Value", f"${potential_value:,.0f}")

st.info(f"**{segment_selector}:** {selected_segment['description']}")
st.success(f"**Opportunity:** {selected_segment['opportunity']}")

# Interactive scenario analysis
st.markdown("---")
st.header("🎯 What-If Scenario Analysis")

st.write("**Explore different business scenarios by adjusting the parameters in the sidebar.**")

scenario_data = {
    'Scenario': ['Conservative (5% retention)', 'Moderate (10% retention)', 'Aggressive (15% retention)'],
    'Additional Customers': [
        int(total_customers * (5 - current_retention) / 100),
        int(total_customers * (10 - current_retention) / 100),
        int(total_customers * (15 - current_retention) / 100)
    ],
    'Annual Revenue': [
        int(total_customers * (5 - current_retention) / 100 * avg_order_value),
        int(total_customers * (10 - current_retention) / 100 * avg_order_value),
        int(total_customers * (15 - current_retention) / 100 * avg_order_value)
    ],
    'Investment Required': [
        int(total_customers * (5 - current_retention) / 100 * campaign_cost),
        int(total_customers * (10 - current_retention) / 100 * campaign_cost),
        int(total_customers * (15 - current_retention) / 100 * campaign_cost)
    ]
}

scenario_df = pd.DataFrame(scenario_data)
scenario_df['ROI %'] = ((scenario_df['Annual Revenue'] - scenario_df['Investment Required']) / scenario_df['Investment Required'] * 100).round(0)

st.dataframe(scenario_df, use_container_width=True)

# Interactive business recommendations
st.markdown("---")
st.header("🚀 Dynamic Business Recommendations")

if retention_target >= 10:
    st.success(f"🎯 **Aggressive Growth Strategy** (Target: {retention_target}%)")
    st.write("**Recommended Actions:**")
    st.write("• Launch comprehensive loyalty program")
    st.write("• Implement AI-powered personalization")
    st.write("• Deploy multi-channel retention campaigns")
    st.write(f"• Expected ROI: {roi:.0f}%")
elif retention_target >= 7:
    st.info(f"📈 **Balanced Growth Strategy** (Target: {retention_target}%)")
    st.write("**Recommended Actions:**")
    st.write("• Email marketing to potential loyalists")
    st.write("• Basic loyalty point system")
    st.write("• Targeted product recommendations")
    st.write(f"• Expected ROI: {roi:.0f}%")
else:
    st.warning(f"⚠️ **Conservative Strategy** (Target: {retention_target}%)")
    st.write("**Recommended Actions:**")
    st.write("• Focus on customer satisfaction")
    st.write("• Improve product quality and service")
    st.write("• Basic follow-up campaigns")
    st.write(f"• Expected ROI: {roi:.0f}%")

# Technical skills showcase
st.markdown("---")
st.header("🏆 Technical Skills Demonstrated")

col1, col2 = st.columns(2)

with col1:
    st.subheader("Interactive Development")
    st.write("✅ **Streamlit Widgets**: Sliders, selectors, radio buttons")
    st.write("✅ **Dynamic Calculations**: Real-time metric updates")
    st.write("✅ **Interactive Charts**: Plotly with multiple data series")
    st.write("✅ **User Experience**: Sidebar controls and responsive layout")

with col2:
    st.subheader("Business Analytics")
    st.write("✅ **Scenario Modeling**: What-if analysis capabilities")
    st.write("✅ **ROI Calculations**: Investment vs return analysis")
    st.write("✅ **Segment Analysis**: Customer behavior insights")
    st.write("✅ **Strategic Recommendations**: Data-driven decisions")

# Footer with call to action
st.markdown("---")
st.info("💡 **Try it out!** Use the sidebar controls to explore different retention strategies and see their impact on revenue.")
st.markdown("**Technologies**: Python • Streamlit • Plotly • Interactive Analytics")