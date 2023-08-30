import {NotificationInstance} from "antd/es/notification/interface";
import {Col, Row, Statistic} from "antd";
import {useWheelTicks} from "../hooks/useWheelTicks.tsx";

export function WheelTicksComponent(props: { api: NotificationInstance }) {
    const wheelTicks = useWheelTicks(props.api);
    return <Row gutter={[16, 16]}>
        <Col lg={8} xs={24}><Statistic title="Rear Left" value={wheelTicks?.WheelTicksRl}/></Col>
        <Col lg={8} xs={24}><Statistic title="Rear Right" value={wheelTicks?.WheelTicksRr}/></Col>
        <Col lg={8} xs={24}><Statistic title="Rear Left Direction" value={wheelTicks?.WheelDirectionRl}/></Col>
        <Col lg={8} xs={24}><Statistic title="Rear Right Direction" value={wheelTicks?.WheelDirectionRr}/></Col>
    </Row>;
}