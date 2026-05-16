import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={1800} // 60 seconds max to accommodate long scripts
        fps={30}
        width={1080}
        height={1920}
        defaultProps={{
          blueprintFile: "latest_blueprint.json",
        }}
        // When rendering via CLI, you can override with:
        //   npx remotion render MyComp --props='{"blueprintFile":"MyProduct_blueprint.json"}'
      />
    </>
  );
};
