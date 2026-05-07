import "./Loader.css";

/**
 * 三点循环加载动画：. → .. → ... → . （周期 1.2s）
 * 与 Primit 主色脱钩，使用 currentColor 适应任何上下文。
 */
export default function Loader() {
  return (
    <span className="dots-loader" aria-label="Loading" role="status">
      <span className="dots-loader__dot" />
      <span className="dots-loader__dot" />
      <span className="dots-loader__dot" />
    </span>
  );
}
