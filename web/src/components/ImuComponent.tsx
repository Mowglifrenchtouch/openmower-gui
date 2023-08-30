import {NotificationInstance} from "antd/es/notification/interface";
import {Col, Row, Statistic} from "antd";
import {useImu} from "../hooks/useImu.tsx";

export function ImuComponent(props: { api: NotificationInstance }) {
    const imu = useImu(props.api);
    return <Row gutter={[16, 16]}>
        <Col lg={8} xs={24}><Statistic precision={9} title="Angular Velocity X"
                                       value={imu.AngularVelocity?.X}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Angular Velocity Y"
                                       value={imu.AngularVelocity?.Y}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Angular Velocity Z"
                                       value={imu.AngularVelocity?.Z}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Linear Acceleration X"
                                       value={imu.LinearAcceleration?.X}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Linear Acceleration Y"
                                       value={imu.LinearAcceleration?.Y}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Linear Acceleration Z"
                                       value={imu.LinearAcceleration?.Z}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Orientation X" value={imu.Orientation?.X}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Orientation Y" value={imu.Orientation?.Y}/></Col>
        <Col lg={8} xs={24}><Statistic precision={9} title="Orientation Z" value={imu.Orientation?.Z}/></Col>
    </Row>;
}